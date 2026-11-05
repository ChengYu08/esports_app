import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { fetchActiveQuickMatch } from "@/features/match/api/match.api";
import {
  isOwnActiveActivityRequest,
  isQuickMatchActive,
  type QuickMatchRequestDetail,
} from "@/features/match/api/match.types";
import { useQuickMatchEndSignals } from "@/features/match/quick-match-end-signals";
import { ClubQuickMatchSheet } from "@/features/match/components/ClubQuickMatchSheet";
import { clientAuthApi } from "@/features/auth/client-auth.api";
import { messageStore } from "@/features/message/message-store";
import { useAuthStore } from "@esports/auth";
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  KeyboardAvoidingView,
  useKeyboardState,
} from "react-native-keyboard-controller";
import { showToast } from "@/shared/ui/app-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppConfirm } from "@/shared/ui/app-confirm";

import { VoiceRoomBackground, VOICE_ROOM_BG_BASE } from "../components/VoiceRoomBackground";
import { VoiceRoomConversationsSheet } from "../components/VoiceRoomConversationsSheet";
import { VoiceRoomExitDialog } from "../components/VoiceRoomExitDialog";
import { VoiceRoomMemberSheet } from "../components/VoiceRoomMemberSheet";
import { VoiceRoomSpeakingWaves } from "../components/VoiceRoomSpeakingWaves";
import { VoiceRoomToolbar } from "../components/VoiceRoomToolbar";
import { exitVoiceRoom } from "../exit-voice-room";
import {
  buildMemberChangeMessage,
  memberChangeNoticeKey,
  resolveMemberChangeNickname,
  shouldSkipMemberChangeNotice,
  type MemberChangeAction,
} from "../member-change-notice";
import { inviteMember, normalizeMembers } from "../member-normalize";
import { useCustomerServiceCall } from "../use-customer-service-call";
import { useVoiceRoomMessages } from "../use-voice-room-messages";
import { useVoiceRoomMembersReconcile } from "../use-voice-room-members-reconcile";
import { useVoiceRoomReception } from "../use-voice-room-reception";
import { useVoiceRoomRtc } from "../use-voice-room-rtc";
import { useVoiceRoomSessionStore } from "../voice-room-session";
import {
  sendVoiceChatMessage,
  subscribeVoiceChatMembers,
  subscribeVoiceChatMessages,
} from "../voice-room-rongcloud";
import { muteVoiceRtc } from "../voice-room-rtc";
import type {
  VoiceRoomDetail,
  VoiceRoomMember,
  VoiceRoomMemberRole,
  VoiceRoomMessage,
} from "../voice-room.types";

/** 麦位槽位高度（含昵称），对齐 Figma Component 7 */
const MEMBER_SLOT_HEIGHT = 103;
const MEMBER_ROW_GAP = 12;
const GRID_PADDING_TOP = 24;
const GRID_PADDING_BOTTOM = 12;
const SEAT_MAX_ROWS = 3;
/** 麦位区最大高度：最多 3 行，超出后区域内滚动 */
const SEAT_AREA_MAX_HEIGHT =
  GRID_PADDING_TOP +
  GRID_PADDING_BOTTOM +
  MEMBER_SLOT_HEIGHT * SEAT_MAX_ROWS +
  MEMBER_ROW_GAP * (SEAT_MAX_ROWS - 1);

const closeIcon = require("../../../../assets/svgs/navbar-exit.svg");
const inviteIcon = require("../../../../assets/svgs/toolbar-invite.svg");
const invitePlaceholderIcon = require("../../../../assets/svgs/game.svg");
const defaultAvatar = require("../../../../assets/images/avatar_default.webp");

function avatarSource(member: VoiceRoomMember) {
  const avatar = member.avatar?.trim();
  if (avatar)
    return { uri: avatar.startsWith("//") ? `https:${avatar}` : avatar };
  return defaultAvatar;
}

// 成员槽位独立 memo 组件：消息到达/输入框打字等父组件重渲染时麦位不参与重渲，
// 仅 speaking 变化的槽位更新。头像不做开麦/闭麦角标，也不展示房主标签。
const MemberSlot = memo(function MemberSlot({
  member,
  columns,
  speaking,
  inviteLabel,
  onPress,
}: {
  member: VoiceRoomMember;
  columns: number;
  speaking: boolean;
  inviteLabel: string;
  onPress: (member: VoiceRoomMember) => void;
}) {
  const invite = member.userId === "invite";
  const isService = member.role === "service";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        invite
          ? inviteLabel
          : `查看${member.nickname}的资料${speaking ? "，正在说话" : ""}`
      }
      style={[styles.memberSlot, { width: `${100 / columns}%` }]}
      onPress={() => onPress(member)}
    >
      <View style={styles.avatarWrap}>
        {invite ? (
          <View style={styles.inviteAvatar}>
            <Image
              source={
                inviteLabel === "接待邀请中" ? inviteIcon : invitePlaceholderIcon
              }
              style={styles.invitePlaceholderIcon}
            />
          </View>
        ) : (
          <Image source={avatarSource(member)} style={styles.avatar} />
        )}
        {!invite ? <VoiceRoomSpeakingWaves active={speaking} /> : null}
        {isService ? (
          <View style={styles.serviceBadge}>
            <Text style={styles.serviceBadgeText}>接待</Text>
          </View>
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        style={[styles.memberName, invite && styles.inviteName]}
      >
        {invite ? inviteLabel : member.nickname}
      </Text>
    </Pressable>
  );
});

export default function VoiceRoomScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string | string[];
    v?: string | string[];
    scene?: string | string[];
    requestNo?: string | string[];
    expireTime?: string | string[];
    gameId?: string | string[];
    gameName?: string | string[];
    gameIconUrl?: string | string[];
    /** 俱乐部接待派单进房后自动呼叫接待 */
    callService?: string | string[];
  }>();
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.user);
  const paramStr = (value?: string | string[]) =>
    typeof value === "string" ? value : value?.[0];
  const roomId = paramStr(params.id);
  const invitedRoomVersion = paramStr(params.v);
  const routeScene = paramStr(params.scene);
  const routeRequestNo = paramStr(params.requestNo);
  const routeExpireTime = paramStr(params.expireTime);
  const routeGameId = paramStr(params.gameId);
  const routeGameName = paramStr(params.gameName);
  const routeGameIconUrl = paramStr(params.gameIconUrl);
  const shouldAutoCallService = paramStr(params.callService) === "1";
  const sessionActiveRoom = useVoiceRoomSessionStore((state) => state.activeRoom);
  const [room, setRoom] = useState<VoiceRoomDetail | null>(null);
  const [members, setMembers] = useState<VoiceRoomMember[]>(() =>
    normalizeMembers(undefined, currentUser || undefined),
  );
  const membersRef = useRef(members);
  membersRef.current = members;
  const [input, setInput] = useState("");
  // 键盘可见性来自 keyboard-controller 原生事件，顶起由 KeyboardAvoidingView 处理
  const keyboardOpen = useKeyboardState((state) => state.isVisible);
  const [selectedMember, setSelectedMember] = useState<VoiceRoomMember | null>(
    null,
  );
  const [memberSheetVisible, setMemberSheetVisible] = useState(false);
  const [conversationsSheetVisible, setConversationsSheetVisible] =
    useState(false);
  const [conversationsSheetMode, setConversationsSheetMode] = useState<
    "chat" | "invite"
  >("chat");
  const [exitDialogVisible, setExitDialogVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [exitError, setExitError] = useState<string | null>(null);
  const exitInFlight = useRef(false);
  const kickedRef = useRef(false);
  const focusedRef = useRef(false);
  /** 是否已发生过首次聚焦：守卫只在「重新聚焦」时生效，避开首次进房 session 尚未建立的时序 */
  const everFocusedRef = useRef(false);
  /** 本屏实例标识（React useId，每次 mount 唯一），写入 session.screenFocusOwnerId 作为聚焦权归属 */
  const roomScreenId = useId();
  // 守卫经 ref 读最新 roomId，不进 useFocusEffect deps：房内 dismissTo 切房
  // 只变 params 不产生真实 blur→focus，若进 deps 会触发 cleanup→重跑，
  // 此时旧房已 exit（activeRoom 为空）、新房 beginRoomJoin 尚未执行，守卫会误判空壳并弹出新房。
  // 本 effect 声明在守卫之前，聚焦守卫执行时 ref 已同步完成。
  const roomIdRef = useRef(roomId);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);
  const [micChanging, setMicChanging] = useState(false);
  const [distanceEnabled, setDistanceEnabled] = useState(false);
  /**
   * 两套独立校验态（null=校验中不展示）：
   * - audition：老板需试音自发
   * - quickMatchCreated：客服代发 QUICK_MATCH_CREATED
   */
  const [matchActiveForAudition, setMatchActiveForAudition] = useState<
    boolean | null
  >(null);
  const [matchActiveForQuickMatchCreated, setMatchActiveForQuickMatchCreated] =
    useState<boolean | null>(null);
  /** 本人进行中的活动需求（秒杀派单）：进房/聚焦时刷新一次，不轮询 */
  const [activityRequest, setActivityRequest] =
    useState<QuickMatchRequestDetail | null>(null);
  /** 活动需求系统提示只插一次 */
  const activityTipShownRef = useRef(false);

  const chatroomId = room?.rongChatroomId;
  const roomTitle = room?.roomName || "语聊房";
  const memberColumns = members.length <= 2 ? 2 : members.length === 3 ? 3 : 4;
  const seatRowCount = Math.ceil(members.length / memberColumns) || 1;
  const seatNeedsScroll = seatRowCount > SEAT_MAX_ROWS;
  // 麦位点击回调：setState 均为稳定引用，供 MemberSlot memo 生效
  const handleSlotPress = useCallback((member: VoiceRoomMember) => {
    Keyboard.dismiss();
    if (member.userId === "invite") {
      setConversationsSheetMode("invite");
      setConversationsSheetVisible(true);
      return;
    }
    setSelectedMember(member);
    setMemberSheetVisible(true);
  }, []);

  const roleByUserId = useCallback(
    (userId?: string): VoiceRoomMemberRole | undefined => {
      if (!userId) return undefined;
      return members.find((member) => member.userId === userId)?.role;
    },
    [members],
  );

  const {
    messages,
    setMessages,
    messageListRef,
    renderMessageItem,
    messageKeyExtractor,
    handleMessageScroll,
    handleMessageContentSizeChange,
    followLatestMessage,
  } = useVoiceRoomMessages(roleByUserId);

  const isOwner =
    Boolean(currentUser?.id) &&
    String(room?.creatorUserId ?? "") === String(currentUser?.id);
  const hasService = Boolean(room?.serviceUserId);
  const canServiceDispatch =
    Boolean(currentUser?.id) &&
    room?.serviceUserId != null &&
    String(room.serviceUserId) === String(currentUser?.id);

  const {
    loading,
    error,
    rtcReady,
    muted,
    setMicState,
    setRtcReadyRoomId,
    speakingUserIds,
    hydrateMemberProfile,
    roomRef,
  } = useVoiceRoomRtc({
    roomId,
    accessToken,
    currentUser,
    room,
    invitedRoomVersion,
    routeScene,
    routeRequestNo,
    routeExpireTime,
    routeGameId,
    routeGameName,
    routeGameIconUrl,
    kickedRef,
    setRoom,
    setMembers,
    setMessages,
  });

  const { serviceCalling, callService, refreshServiceUserId } =
    useCustomerServiceCall({
      roomId,
      accessToken,
      room,
      isOwner,
      rtcReady,
      loading,
      shouldAutoCallService,
      setRoom,
    });

  useVoiceRoomMembersReconcile({
    roomId,
    accessToken,
    currentUser,
    roomRef,
    kickedRef,
    hydrateMemberProfile,
    setMembers,
  });

  const {
    receptionVisible,
    setReceptionVisible,
    receptionClub,
    receptionGames,
    receptionBuyerId,
    receptionBuyerName,
    onServiceDispatch,
  } = useVoiceRoomReception({
    accessToken,
    room,
    currentUser,
    canServiceDispatch,
  });

  const inviteSlotLabel = serviceCalling ? "接待邀请中" : "邀请用户";

  // ---- 场景 A：试音自发 ----
  const auditionFromSession =
    sessionActiveRoom &&
    sessionActiveRoom.roomId === roomId &&
    sessionActiveRoom.scene === "audition"
      ? sessionActiveRoom
      : null;
  const isAuditionScene =
    routeScene === "audition" || Boolean(auditionFromSession);
  const auditionRequestNo =
    routeRequestNo || auditionFromSession?.matchRequestNo || undefined;

  // ---- 场景 B：QUICK_MATCH_CREATED 客服代发（仅 session，不走路由 scene）----
  const quickMatchCreatedFromSession =
    sessionActiveRoom &&
    sessionActiveRoom.roomId === roomId &&
    sessionActiveRoom.scene === "quickMatchCreated"
      ? sessionActiveRoom
      : null;
  const isQuickMatchCreatedScene = Boolean(quickMatchCreatedFromSession);
  const quickMatchCreatedRequestNo =
    quickMatchCreatedFromSession?.matchRequestNo || undefined;

  // 「选择陪玩」与「呼叫接待」互斥（对齐 PC）：进行中的派单已包含呼叫客服语义，该位置让给「选择陪玩」。
  // 覆盖三类进行中派单：试音自发、客服代发（QUICK_MATCH_CREATED）、活动需求（activity/publish）
  const showSelectCompanion =
    (isOwner &&
      isAuditionScene &&
      Boolean(auditionRequestNo) &&
      matchActiveForAudition === true) ||
    (isOwner &&
      isQuickMatchCreatedScene &&
      Boolean(quickMatchCreatedRequestNo) &&
      matchActiveForQuickMatchCreated === true) ||
    (isOwner && Boolean(activityRequest));
  const showCallService = isOwner && !hasService && !showSelectCompanion;

  const minimize = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }, []);

  /** 仅清除 audition 场景标记，不影响 quickMatchCreated */
  const clearAuditionSessionMarkers = useCallback((targetRoomId: string) => {
    const current = useVoiceRoomSessionStore.getState().activeRoom;
    if (!current || current.roomId !== targetRoomId) return;
    if (current.scene != null && current.scene !== "audition") return;
    if (
      current.scene == null &&
      current.matchRequestNo == null &&
      current.matchExpireTime == null &&
      current.matchGameId == null &&
      current.matchGameName == null &&
      current.matchGameIconUrl == null
    ) {
      return;
    }
    useVoiceRoomSessionStore.getState().setActiveRoom({
        roomId: current.roomId,
        roomVersion: current.roomVersion,
        rongChatroomId: current.rongChatroomId,
        roomName: current.roomName,
        creatorUserId: current.creatorUserId,
        ownerName: current.ownerName,
        ownerAvatar: current.ownerAvatar,
      });
  }, []);

  /** 仅清除 quickMatchCreated 场景标记，不影响 audition */
  const clearQuickMatchCreatedSessionMarkers = useCallback(
    (targetRoomId: string) => {
      const current = useVoiceRoomSessionStore.getState().activeRoom;
      if (!current || current.roomId !== targetRoomId) return;
      if (current.scene !== "quickMatchCreated") return;
      useVoiceRoomSessionStore.getState().setActiveRoom({
        roomId: current.roomId,
        roomVersion: current.roomVersion,
        rongChatroomId: current.rongChatroomId,
        roomName: current.roomName,
        creatorUserId: current.creatorUserId,
        ownerName: current.ownerName,
        ownerAvatar: current.ownerAvatar,
      });
    },
    [],
  );

  // 快速匹配超时/取消信令：清除 audition/quickMatchCreated 场景标记（不强制退房，对齐 PC 只清会话）
  const sceneRequestNo = auditionRequestNo || quickMatchCreatedRequestNo;
  useEffect(() => {
    if (!sceneRequestNo || !roomId) return;
    const consumeEndSignal = () => {
      const reason = useQuickMatchEndSignals.getState().consume(sceneRequestNo);
      if (!reason) return;
      clearAuditionSessionMarkers(roomId);
      clearQuickMatchCreatedSessionMarkers(roomId);
      showToast(
        reason === "expired" ? "派单已超时自动取消" : "派单已取消",
      );
    };
    consumeEndSignal();
    return useQuickMatchEndSignals.subscribe(consumeEndSignal);
  }, [
    clearAuditionSessionMarkers,
    clearQuickMatchCreatedSessionMarkers,
    roomId,
    sceneRequestNo,
  ]);

  const openSelectCompanion = useCallback(() => {
    // 活动需求进行中：优先取活动详情跳选人页（选人页会按 requestNo 重拉详情）
    if (activityRequest) {
      const activityRequestNo = activityRequest.requestNo;
      if (!activityRequestNo) return;
      router.push({
        pathname: "/match/matching/[requestNo]",
        params: {
          requestNo: activityRequestNo,
          ...(activityRequest.expireTime
            ? { expireTime: activityRequest.expireTime }
            : {}),
          ...(activityRequest.gameId && activityRequest.gameName
            ? {
                gameId: activityRequest.gameId,
                gameName: activityRequest.gameName,
              }
            : {}),
        },
      });
      return;
    }
    const useQuickMatchCreated =
      matchActiveForQuickMatchCreated === true &&
      Boolean(quickMatchCreatedRequestNo);
    const requestNo = useQuickMatchCreated
      ? quickMatchCreatedRequestNo
      : auditionRequestNo;
    if (!requestNo) return;

    const matchMeta =
      sessionActiveRoom &&
      sessionActiveRoom.roomId === roomId &&
      sessionActiveRoom.scene ===
        (useQuickMatchCreated ? "quickMatchCreated" : "audition")
        ? sessionActiveRoom
        : null;
    const expireTime = useQuickMatchCreated
      ? matchMeta?.matchExpireTime
      : routeExpireTime || matchMeta?.matchExpireTime || undefined;
    const gameId = useQuickMatchCreated
      ? matchMeta?.matchGameId
      : routeGameId || matchMeta?.matchGameId || undefined;
    const gameName = useQuickMatchCreated
      ? matchMeta?.matchGameName
      : routeGameName || matchMeta?.matchGameName || undefined;
    const gameIconUrl = useQuickMatchCreated
      ? matchMeta?.matchGameIconUrl
      : routeGameIconUrl || matchMeta?.matchGameIconUrl || undefined;
    // push 压在语聊房之上；勿用 navigate/singular，否则会重排栈并可能清掉首页
    router.push({
      pathname: "/match/matching/[requestNo]",
      params: {
        requestNo,
        ...(expireTime ? { expireTime } : {}),
        ...(gameId && gameName
          ? {
              gameId,
              gameName,
              ...(gameIconUrl ? { gameIconUrl } : {}),
            }
          : {}),
      },
    });
  }, [
    activityRequest,
    auditionRequestNo,
    matchActiveForQuickMatchCreated,
    quickMatchCreatedRequestNo,
    roomId,
    routeExpireTime,
    routeGameId,
    routeGameIconUrl,
    routeGameName,
    sessionActiveRoom,
  ]);

  /** 路由带试音标记时补写到 session（只写 audition，不覆盖 quickMatchCreated） */
  useEffect(() => {
    if (!roomId || routeScene !== "audition" || !routeRequestNo) return;
    if (matchActiveForAudition === false) return;
    const current = useVoiceRoomSessionStore.getState().activeRoom;
    if (!current || current.roomId !== roomId) return;
    // 客服代发占用中不抢写为 audition
    if (current.scene === "quickMatchCreated") return;
    if (
      current.scene === "audition" &&
      current.matchRequestNo === routeRequestNo
    ) {
      return;
    }
    useVoiceRoomSessionStore.getState().setActiveRoom({
      ...current,
      scene: "audition",
      matchRequestNo: routeRequestNo,
      matchExpireTime: routeExpireTime || current.matchExpireTime,
      matchGameId: routeGameId || current.matchGameId,
      matchGameName: routeGameName || current.matchGameName,
      matchGameIconUrl: routeGameIconUrl || current.matchGameIconUrl,
    });
  }, [
    matchActiveForAudition,
    roomId,
    routeExpireTime,
    routeGameId,
    routeGameIconUrl,
    routeGameName,
    routeRequestNo,
    routeScene,
  ]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      // 聚焦标记：navigateToVoiceRoom 据此区分「房内原地切房（dismissTo）」
      // 与「其他页面进入（push 保留中间路由）」
      useVoiceRoomSessionStore.getState().setScreenFocused(true);
      // A private chat can cover this screen while the global listener exits it.
      if (kickedRef.current) minimize();
      // 旧实例兜底：非聚焦页进房（如聊天页点邀请卡）会叠出同房第二个屏实例，
      // 栈里历史遗留的旧房实例、session 已清空的场景同理。只有最后聚焦过的
      // 实例是当前房屏：重新聚焦时聚焦权不在自己手上、或 session 已切走/清空，
      // 则自动弹出自己，保证返回路径不再出现重复/失效的房屏。
      // 只在真实 blur→focus 时执行；roomId 经 ref 读取（见 roomIdRef 注释）。
      if (everFocusedRef.current && roomIdRef.current) {
        const { activeRoom, joiningRoom, screenFocusOwnerId } =
          useVoiceRoomSessionStore.getState();
        const sessionMismatch =
          !joiningRoom &&
          (!activeRoom || activeRoom.roomId !== roomIdRef.current);
        if (sessionMismatch || screenFocusOwnerId !== roomScreenId) {
          minimize();
          return;
        }
      }
      everFocusedRef.current = true;
      useVoiceRoomSessionStore.getState().setScreenFocusOwner(roomScreenId);
      return () => {
        focusedRef.current = false;
        useVoiceRoomSessionStore.getState().setScreenFocused(false);
      };
    }, [minimize, roomScreenId]),
  );

  /** 场景 A：试音自发 — fetchActiveQuickMatch 校验 */
  useFocusEffect(
    useCallback(() => {
      const needsAuditionCheck =
        isOwner && isAuditionScene && Boolean(auditionRequestNo);
      if (!needsAuditionCheck || !accessToken || !auditionRequestNo) {
        setMatchActiveForAudition(needsAuditionCheck ? null : false);
        return;
      }

      let cancelled = false;
      setMatchActiveForAudition(null);
      void (async () => {
        try {
          const active = await fetchActiveQuickMatch(accessToken);
          if (cancelled) {
            return;
          }
          const ok =
            Boolean(active) &&
            isQuickMatchActive(active) &&
            active!.requestNo === auditionRequestNo;
          setMatchActiveForAudition(ok);
          if (!ok && roomId) clearAuditionSessionMarkers(roomId);
        } catch (error) {
          if (cancelled) {
            return;
          }
          console.warn("[voice-room] audition match check failed", error);
          setMatchActiveForAudition(false);
          if (roomId) clearAuditionSessionMarkers(roomId);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [
      accessToken,
      auditionRequestNo,
      clearAuditionSessionMarkers,
      isAuditionScene,
      isOwner,
      roomId,
    ]),
  );

  /** 场景 B：QUICK_MATCH_CREATED — 同样调 fetchActiveQuickMatch，独立状态 */
  useFocusEffect(
    useCallback(() => {
      const needsQuickMatchCreatedCheck =
        isOwner &&
        isQuickMatchCreatedScene &&
        Boolean(quickMatchCreatedRequestNo);
      if (
        !needsQuickMatchCreatedCheck ||
        !accessToken ||
        !quickMatchCreatedRequestNo
      ) {
        setMatchActiveForQuickMatchCreated(
          needsQuickMatchCreatedCheck ? null : false,
        );
        return;
      }

      let cancelled = false;
      setMatchActiveForQuickMatchCreated(null);
      void (async () => {
        try {
          const active = await fetchActiveQuickMatch(accessToken);
          if (cancelled) {
            return;
          }
          const ok =
            Boolean(active) &&
            isQuickMatchActive(active) &&
            active!.requestNo === quickMatchCreatedRequestNo;
          setMatchActiveForQuickMatchCreated(ok);
          if (!ok && roomId) clearQuickMatchCreatedSessionMarkers(roomId);
        } catch (error) {
          if (cancelled) {
            return;
          }
          console.warn(
            "[voice-room] quickMatchCreated match check failed",
            error,
          );
          setMatchActiveForQuickMatchCreated(false);
          if (roomId) clearQuickMatchCreatedSessionMarkers(roomId);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [
      accessToken,
      clearQuickMatchCreatedSessionMarkers,
      isOwner,
      isQuickMatchCreatedScene,
      quickMatchCreatedRequestNo,
      roomId,
    ]),
  );

  /** 活动需求进行中判定（任务 4）：进房/聚焦时刷新一次，不轮询 */
  useFocusEffect(
    useCallback(() => {
      if (!accessToken) {
        setActivityRequest(null);
        return;
      }
      let cancelled = false;
      void (async () => {
        try {
          const active = await fetchActiveQuickMatch(accessToken);
          if (cancelled) {
            return;
          }
          const own =
            isOwnActiveActivityRequest(active, currentUser?.id) ? active : null;
          setActivityRequest(own);
          // 进房检测到自己是活动需求发起人时插入一次性系统提示
          if (own && !activityTipShownRef.current) {
            activityTipShownRef.current = true;
            setMessages((items) =>
              items.some((item) => item.id === "activity-match-tip")
                ? items
                : [
                    ...items,
                    {
                      id: "activity-match-tip",
                      kind: "notice" as const,
                      text: "点击下方「选择陪玩」按钮查看抢单大神，勾选大神下单",
                      sentAt: Date.now(),
                    },
                  ].slice(-80),
            );
          }
        } catch (cause) {
          if (cancelled) {
            return;
          }
          console.warn("[voice-room] activity match check failed", cause);
          setActivityRequest(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [accessToken, currentUser]),
  );

  useEffect(() => {
    kickedRef.current = false;
    return useVoiceRoomSessionStore.subscribe((state, previous) => {
      const kicked = state.lastKickedRoom;
      if (!kicked || kicked === previous.lastKickedRoom || kicked.roomId !== roomId) return;
      const version = roomRef.current?.roomVersion ?? invitedRoomVersion;
      if (version != null && String(version) !== kicked.roomVersion) return;
      kickedRef.current = true;
      setExitDialogVisible(false);
      setMemberSheetVisible(false);
      setConversationsSheetVisible(false);
      setRtcReadyRoomId(null);
      setMicState(null);
      Keyboard.dismiss();
      if (focusedRef.current) minimize();
    });
  }, [invitedRoomVersion, minimize, roomId, roomRef, setMicState, setRtcReadyRoomId]);

  useEffect(() => {
    if (!chatroomId) return;
    const stopMessages = subscribeVoiceChatMessages((targetId, message) => {
      if (targetId !== chatroomId) return;
      setMessages((items) =>
        [...items, { ...message, kind: "chat" as const }].slice(-80),
      );
    });
    const stopMembers = subscribeVoiceChatMembers((targetId, actions) => {
      if (targetId !== chatroomId) return;
      actions.forEach((action) => {
        const userId = action.userId == null ? "" : String(action.userId);
        if (action.actionType === 1) {
          hydrateMemberProfile(userId, accessToken || "");
          // 呼叫接待期间成员加入 → 反查是否为接单接待
          if (serviceCalling) void refreshServiceUserId(userId);
        }
      });
      // 成员变更时校准 serviceUserId（接待离开后清空）
      void refreshServiceUserId();

      const selfId = currentUser?.id ? String(currentUser.id) : "";
      const version =
        roomRef.current?.roomVersion ?? invitedRoomVersion ?? "1";
      const tips: VoiceRoomMessage[] = [];
      const placeholderTips: { messageId: string; userId: string }[] = [];
      if (roomId) {
        for (const action of actions) {
          const userId = action.userId == null ? "" : String(action.userId);
          if (!userId || userId === "invite" || userId === selfId) continue;
          const changeAction: MemberChangeAction | null =
            action.actionType === 1
              ? "join"
              : action.actionType === 2
                ? "leave"
                : null;
          if (!changeAction) continue;
          const noticeKey = memberChangeNoticeKey(roomId, version, userId);
          if (shouldSkipMemberChangeNotice(noticeKey, changeAction)) continue;
          const { nickname, isPlaceholder } = resolveMemberChangeNickname({
            userId,
            members: membersRef.current,
            currentUser,
          });
          const tip = buildMemberChangeMessage({
            roomId,
            roomVersion: version,
            userId,
            nickname,
            action: changeAction,
          });
          tips.push(tip);
          if (isPlaceholder) {
            placeholderTips.push({ messageId: tip.id, userId });
          }
        }
      }
      if (tips.length > 0) {
        setMessages((items) => [...items, ...tips].slice(-80));
      }
      for (const tip of placeholderTips) {
        if (!accessToken) continue;
        void clientAuthApi
          .getUserProfile(accessToken, tip.userId)
          .then((profile) => {
            if (!profile.nickname) return;
            setMessages((items) =>
              items.map((item) =>
                item.id === tip.messageId
                  ? { ...item, nickname: profile.nickname }
                  : item,
              ),
            );
          })
          .catch(() => undefined);
      }

      setMembers((items) =>
        actions.reduce<VoiceRoomMember[]>((next, action) => {
          const userId = action.userId == null ? "" : String(action.userId);
          if (!userId || userId === "invite" || userId === currentUser?.id)
            return next;
          if (action.actionType === 2)
            return next.filter((member) => member.userId !== userId);
          if (
            action.actionType === 1 &&
            !next.some((member) => member.userId === userId)
          ) {
            return [
              ...next.filter((member) => member.userId !== "invite"),
              {
                userId,
                nickname: `用户${userId}`,
                role:
                  String(room?.creatorUserId ?? "") === userId
                    ? ("owner" as const)
                    : String(room?.serviceUserId ?? "") === userId
                      ? ("service" as const)
                      : ("guest" as const),
              },
              inviteMember,
            ].slice(0, 8);
          }
          return next;
        }, items),
      );
    });
    return () => {
      stopMessages();
      stopMembers();
    };
  }, [
    accessToken,
    chatroomId,
    currentUser,
    hydrateMemberProfile,
    invitedRoomVersion,
    refreshServiceUserId,
    room?.creatorUserId,
    room?.serviceUserId,
    roomId,
    roomRef,
    serviceCalling,
    setMessages,
  ]);

  const confirmExit = async () => {
    if (exitInFlight.current || !roomId || !room) return;
    if (!accessToken || !currentUser?.id) {
      setExitError("登录状态已失效，请重新登录后重试");
      return;
    }
    exitInFlight.current = true;
    setLeaving(true);
    setExitError(null);
    try {
      await exitVoiceRoom(
        { ...room, roomId },
        String(currentUser.id),
        accessToken,
      );
      setExitDialogVisible(false);
      minimize();
    } catch (cause) {
      setExitError(
        cause instanceof Error ? cause.message : "操作失败，请稍后重试",
      );
    } finally {
      exitInFlight.current = false;
      setLeaving(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    followLatestMessage();
    setInput("");
    const local = {
      id: `local-${Date.now()}`,
      userId: currentUser?.id ? String(currentUser.id) : undefined,
      nickname: currentUser?.nickname || "我",
      text,
      sentAt: Date.now(),
      kind: "chat" as const,
    };
    setMessages((items) => [...items, local].slice(-80));
    if (chatroomId)
      await sendVoiceChatMessage(
        chatroomId,
        text,
        currentUser?.id
          ? {
              userId: String(currentUser.id),
              nickname: currentUser.nickname,
              headImage: currentUser.headImage,
            }
          : undefined,
      ).catch(() => {
        void useAppConfirm.getState().confirm({
          title: "发送失败",
          message: "请稍后重试",
        });
      });
  };

  const ensureMicrophonePermission = async () => {
    let currentPermission: Awaited<
      ReturnType<typeof getRecordingPermissionsAsync>
    > | null = null;
    try {
      currentPermission = await getRecordingPermissionsAsync();
    } catch {
      // Continue with the explanatory dialog when the native permission status is unavailable.
    }

    if (currentPermission?.granted) return true;

    if (currentPermission && !currentPermission.canAskAgain) {
      const goSettings = await useAppConfirm.getState().confirm({
        title: "需要麦克风权限",
        message: "请在系统设置中允许盼之电竞使用麦克风后再开麦。",
        cancelText: "取消",
        confirmText: "去设置",
      });
      if (goSettings) void Linking.openSettings();
      return false;
    }

    const goAuthorize = await useAppConfirm.getState().confirm({
      title: "需要麦克风权限",
      message: "开麦需要使用麦克风，请允许盼之电竞访问麦克风。",
      cancelText: "取消",
      confirmText: "去授权",
    });
    if (!goAuthorize) return false;

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (permission.granted) return true;
      if (!permission.canAskAgain) {
        const goSettings = await useAppConfirm.getState().confirm({
          title: "麦克风权限已关闭",
          message: "请在系统设置中允许盼之电竞使用麦克风后再开麦。",
          cancelText: "取消",
          confirmText: "去设置",
        });
        if (goSettings) void Linking.openSettings();
      }
    } catch {
      // The caller keeps the room in listen-only mode when permission cannot be requested.
    }
    return false;
  };

  const toggleMute = async () => {
    if (!rtcReady || micChanging) return;
    const next = !muted;
    setMicChanging(true);
    try {
      if (!next) {
        if (!(await ensureMicrophonePermission())) return;
      }
      const result = muteVoiceRtc(next);
      if (result !== 0) throw new Error(`麦克风状态切换失败（${result}）`);
      setMicState({ roomId: roomId!, muted: next });
      setMembers((items) =>
        items.map((item) =>
          item.userId === currentUser?.id ? { ...item, micOpen: !next } : item,
        ),
      );
      showToast(next ? "已闭麦" : "已开麦");
    } catch {
      showToast("麦克风不可用，当前可以听到房间语音，请检查设备或权限");
    } finally {
      setMicChanging(false);
    }
  };

  const getInviteLink = () => {
    if (!roomId || !room) {
      showToast("房间信息加载中，请稍后再试");
      return null;
    }
    return `https://djpc.jlgkj.top/chat?type=chat-room&id=${encodeURIComponent(roomId)}&v=${encodeURIComponent(String(room.roomVersion ?? "1"))}`;
  };

  /** @returns 是否发送成功；成功 Toast 由 ConversationsSheet 在关闭后再展示，避免随 Modal 卸载闪退 */
  const sendInviteLink = async (peerId: string): Promise<boolean> => {
    const inviteLink = getInviteLink();
    if (!inviteLink) return false;
    if (!accessToken) {
      showToast("请先登录");
      return false;
    }
    try {
      await messageStore.getState().initialize(accessToken);
      const state = messageStore.getState();
      if (state.connectionState !== "ready") {
        showToast("消息服务未连接，请稍后再试");
        return false;
      }
      await state.sendText(peerId, inviteLink);
      // sendText 内部 catch 错误后通过 set() 更新 store，必须重新 getState() 才能读到最新 lastError
      const failed = messageStore.getState().lastError;
      if (failed) {
        showToast(failed);
        return false;
      }
      return true;
    } catch {
      showToast("邀请发送失败，请稍后再试");
      return false;
    }
  };

  const seatSlots = members.map((member, index) => {
    // speaking 来自独立的 speakingUserIds（声网音量回调高频更新的原子 state）
    const speaking = rtcReady && speakingUserIds.includes(member.userId);
    return (
      <MemberSlot
        key={`${member.userId}-${index}`}
        member={member}
        columns={memberColumns}
        speaking={speaking}
        inviteLabel={inviteSlotLabel}
        onPress={handleSlotPress}
      />
    );
  });

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <VoiceRoomBackground />
      <KeyboardAvoidingView
        behavior="padding"
        style={[styles.safe, { paddingTop: insets.top }]}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="收起语聊房"
            onPress={minimize}
            disabled={leaving}
            hitSlop={12}
            style={styles.headerButton}
          >
            <ChevronLeft24Regular color="white" width={24} height={24} style={styles.headerIcon} />
          </Pressable>
          <Text style={styles.title}>{roomTitle}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={room ? (isOwner ? "解散语聊房" : "退出语聊房") : "退出语聊房"}
            disabled={leaving}
            onPress={() => {
              Keyboard.dismiss();
              if (!room) {
                minimize();
                return;
              }
              setExitError(null);
              setExitDialogVisible(true);
            }}
            hitSlop={12}
            style={styles.headerButton}
          >
            <Image source={closeIcon} style={styles.headerIcon} />
          </Pressable>
        </View>

        {/* <View style={styles.roomMeta}>
          <Text style={styles.roomName}>{room?.roomName || '陪玩开黑语音房'}</Text>
          <Text style={styles.roomId}>房间号 {roomId || '--'}</Text>
        </View> */}

        {seatNeedsScroll ? (
          <ScrollView
            style={styles.seatScroll}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {seatSlots}
          </ScrollView>
        ) : (
          <View style={styles.grid}>{seatSlots}</View>
        )}

        <View style={styles.chatPanel}>
          {loading ? (
            <ActivityIndicator color="#B8C5FF" style={styles.loading} />
          ) : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <FlatList
            ref={messageListRef}
            data={messages}
            keyExtractor={messageKeyExtractor}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onScroll={handleMessageScroll}
            scrollEventThrottle={16}
            onContentSizeChange={handleMessageContentSizeChange}
            onLayout={handleMessageContentSizeChange}
          />
        </View>

        <VoiceRoomToolbar
          bottomInset={insets.bottom}
          keyboardOpen={keyboardOpen}
          input={input}
          muted={muted}
          rtcReady={rtcReady}
          connecting={loading}
          micChanging={micChanging}
          leaving={leaving}
          serviceCalling={serviceCalling}
          distanceEnabled={distanceEnabled}
          showCallService={showCallService}
          showServiceDispatch={canServiceDispatch}
          showSelectCompanion={showSelectCompanion}
          onToggleDistance={() => setDistanceEnabled((prev) => !prev)}
          onChangeText={setInput}
          onSend={() => void sendMessage()}
          onToggleMute={() => void toggleMute()}
          onOpenMessages={() => {
            Keyboard.dismiss();
            setConversationsSheetMode("chat");
            setConversationsSheetVisible(true);
          }}
          onInvite={() => {
            Keyboard.dismiss();
            setConversationsSheetMode("invite");
            setConversationsSheetVisible(true);
          }}
          onCallService={() => void callService()}
          onServiceDispatch={() => void onServiceDispatch()}
          onSelectCompanion={openSelectCompanion}
        />
      </KeyboardAvoidingView>
      <VoiceRoomExitDialog
        visible={exitDialogVisible}
        isOwner={isOwner}
        pending={leaving}
        error={exitError}
        onCancel={() => {
          if (!exitInFlight.current) setExitDialogVisible(false);
        }}
        onConfirm={() => void confirmExit()}
      />
      <VoiceRoomConversationsSheet
        visible={conversationsSheetVisible}
        onClose={() => setConversationsSheetVisible(false)}
        sendTextTo={
          conversationsSheetMode === "invite" ? sendInviteLink : undefined
        }
      />
      {receptionClub ? (
        <ClubQuickMatchSheet
          visible={receptionVisible}
          onClose={() => setReceptionVisible(false)}
          club={receptionClub}
          games={receptionGames}
          mode="reception"
          buyerUserId={receptionBuyerId}
          buyerNickname={receptionBuyerName}
        />
      ) : null}
      <VoiceRoomMemberSheet
        visible={memberSheetVisible}
        member={
          members.find((member) => member.userId === selectedMember?.userId) ??
          selectedMember
        }
        room={room}
        roomId={roomId}
        /** 活动需求进行中：MemberSheet「主页」入口替换为提示文案，下单统一走「选择陪玩」选人页 */
        orderEntryBlockedText={
          activityRequest
            ? "活动需求进行中，请点击「选择陪玩」按钮选人下单"
            : undefined
        }
        onClose={() => setMemberSheetVisible(false)}
        onMemberKicked={(userId) => {
          setMembers((items) =>
            items.filter((member) => member.userId !== userId),
          );
          if (selectedMember?.userId === userId) setMemberSheetVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: VOICE_ROOM_BG_BASE },
  safe: { flex: 1 },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: { width: 24, height: 24 },
  title: { color: "#F6F7FF", fontSize: 17, fontWeight: "700" },
  roomMeta: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 12 },
  roomName: { color: "#F7F8FF", fontSize: 16, fontWeight: "700" },
  roomId: { color: "#9296B3", fontSize: 11, marginTop: 5 },
  seatScroll: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: SEAT_AREA_MAX_HEIGHT,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: GRID_PADDING_TOP,
    paddingBottom: GRID_PADDING_BOTTOM,
    alignItems: "flex-start",
    alignContent: "flex-start",
    rowGap: MEMBER_ROW_GAP,
  },
  memberSlot: {
    alignItems: "center",
    minHeight: MEMBER_SLOT_HEIGHT,
    overflow: "visible",
  },
  avatarWrap: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  inviteAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  invitePlaceholderIcon: { width: 24, height: 24 },
  serviceBadge: {
    position: "absolute",
    left: -2,
    bottom: -2,
    backgroundColor: "#B81636",
    borderRadius: 52,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  serviceBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "600",
    lineHeight: 12,
  },
  memberName: {
    color: "#FFFFFF",
    fontSize: 11,
    lineHeight: 16,
    maxWidth: 76,
    marginTop: 16,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.15)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  inviteName: { color: "#979799", textShadowColor: "transparent" },
  chatPanel: {
    flex: 1,
    marginTop: 0,
    marginHorizontal: 16,
    minHeight: 96,
  },
  loading: { marginTop: 12 },
  errorText: {
    color: "#FFB1B6",
    fontSize: 12,
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  messageList: {
    flexGrow: 1,
    paddingTop: 0,
    paddingBottom: 10,
    gap: 8,
  },
});
