import { clientAuthApi } from "@/features/auth/client-auth.api";
import { useAuthStore } from "@esports/auth";
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Toast from "react-native-root-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VoiceRoomExitDialog } from "../components/VoiceRoomExitDialog";
import { VoiceRoomMemberSheet } from "../components/VoiceRoomMemberSheet";
import { VoiceRoomMicBadge } from "../components/VoiceRoomMicrophone";
import { VoiceRoomToolbar } from "../components/VoiceRoomToolbar";
import { exitVoiceRoom } from "../exit-voice-room";
import {
  getVoiceChatHistory,
  joinVoiceChatRoom,
  sendVoiceChatMessage,
  subscribeVoiceChatMembers,
  subscribeVoiceChatMessages,
} from "../voice-room-rongcloud";
import {
  clearVoiceRtcCallbacks,
  getVoiceRtcMuted,
  getVoiceRtcRemoteUserIds,
  joinVoiceRtc,
  muteVoiceRtc,
} from "../voice-room-rtc";
import { useVoiceRoomSessionStore } from "../voice-room-session";
import { voiceRoomApi } from "../voice-room.api";
import type {
  VoiceRoomDetail,
  VoiceRoomMember,
  VoiceRoomMessage,
} from "../voice-room.types";

const background = require("../../../../assets/voice-room/background.svg");
const backIcon = require("../../../../assets/voice-room/back.svg");
const closeIcon = require("../../../../assets/voice-room/close.svg");
const inviteIcon = require("../../../../assets/voice-room/invite.svg");
const defaultAvatar = require("../../../../assets/voice-room/avatar-default.png");
const ringOwner = require("../../../../assets/voice-room/ring-owner.svg");
const ringInvite = require("../../../../assets/voice-room/ring-invite.svg");

const inviteMember: VoiceRoomMember = {
  userId: "invite",
  nickname: "邀请用户",
  role: "guest",
};

function avatarSource(member: VoiceRoomMember) {
  const avatar = member.avatar?.trim();
  if (avatar)
    return { uri: avatar.startsWith("//") ? `https:${avatar}` : avatar };
  return defaultAvatar;
}

function normalizeMembers(
  detail: VoiceRoomDetail | undefined,
  currentUser?: { id: string; nickname?: string; headImage?: string },
) {
  const currentUserId = currentUser ? String(currentUser.id) : undefined;
  const creatorUserId =
    detail?.creatorUserId == null ? "" : String(detail.creatorUserId);
  const serviceUserId =
    detail?.serviceUserId == null ? "" : String(detail.serviceUserId);
  const self: VoiceRoomMember[] = currentUser
    ? [
        {
          userId: currentUserId!,
          nickname: currentUser.nickname || "我",
          avatar: currentUser.headImage,
          role:
            creatorUserId === currentUserId ? ("owner" as const) : undefined,
        },
      ]
    : [];
  const people = (detail?.members || [])
    .filter(
      (member) =>
        String(member.userId) !== currentUserId && member.userId !== "invite",
    )
    .map((member) => {
      const userId = String(member.userId);
      const role =
        userId === creatorUserId
          ? ("owner" as const)
          : userId === serviceUserId
            ? ("service" as const)
            : member.role;
      return { ...member, userId, role };
    });
  const normalizedMembers: VoiceRoomMember[] = [...self, ...people];
  return [...normalizedMembers.slice(0, 7), inviteMember];
}

function displayMessage(message: VoiceRoomMessage) {
  if (message.kind === "notice")
    return <Text style={styles.noticeText}>{message.text}</Text>;
  return (
    <View style={styles.messageRow}>
      <Text style={styles.messageName}>{message.nickname || "用户"}</Text>
      <Text style={styles.messageBody}>{message.text}</Text>
    </View>
  );
}

export default function VoiceRoomScreen() {
  const insets = useSafeAreaInsets();
  const { id, v } = useLocalSearchParams<{
    id: string | string[];
    v?: string | string[];
  }>();
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.user);
  const setActiveRoom = useVoiceRoomSessionStore(
    (state) => state.setActiveRoom,
  );
  const roomId = typeof id === "string" ? id : id?.[0];
  const invitedRoomVersion = typeof v === "string" ? v : v?.[0];
  const [room, setRoom] = useState<VoiceRoomDetail | null>(null);
  const [members, setMembers] = useState<VoiceRoomMember[]>(() =>
    normalizeMembers(undefined, currentUser || undefined),
  );
  const [messages, setMessages] = useState<VoiceRoomMessage[]>([
    {
      id: "welcome",
      kind: "notice",
      text: "欢迎来到语聊房，和大家一起开黑吧",
      sentAt: 1,
    },
    {
      id: "tips",
      kind: "system",
      text: "房间内请文明交流，友善互动",
      sentAt: 2,
    },
  ]);
  const [input, setInput] = useState("");
  const [selectedMember, setSelectedMember] = useState<VoiceRoomMember | null>(
    null,
  );
  const [memberSheetVisible, setMemberSheetVisible] = useState(false);
  const [exitDialogVisible, setExitDialogVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [exitError, setExitError] = useState<string | null>(null);
  const exitInFlight = useRef(false);
  const [rtcReadyRoomId, setRtcReadyRoomId] = useState<string | null>(null);
  const [micState, setMicState] = useState<{
    roomId: string;
    muted: boolean;
  } | null>(null);
  const [micChanging, setMicChanging] = useState(false);
  const [serviceCalling, setServiceCalling] = useState(false);
  const [loading, setLoading] = useState(() => Boolean(roomId && accessToken));
  const [error, setError] = useState<string | null>(() =>
    !roomId ? "语聊房不存在" : !accessToken ? "请先登录后进入语聊房" : null,
  );

  const roomVersion = room?.roomVersion ?? "1";
  const chatroomId = room?.rongChatroomId;
  const roomTitle = room?.roomName || "语聊房";
  const memberColumns = members.length <= 2 ? 2 : members.length === 3 ? 3 : 4;
  const isOwner =
    Boolean(currentUser?.id) &&
    String(room?.creatorUserId ?? "") === String(currentUser?.id);
  const rtcReady = Boolean(roomId && rtcReadyRoomId === roomId);
  const muted = !roomId || micState?.roomId !== roomId || micState.muted;
  const profileRequests = useRef(new Set<string>());
  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  const hydrateMemberProfile = useCallback(
    (userId: string, token: string) => {
      if (
        !userId ||
        !token ||
        userId === currentUser?.id ||
        profileRequests.current.has(userId)
      )
        return;
      profileRequests.current.add(userId);
      void clientAuthApi
        .getUserProfile(token, userId)
        .then((profile) => {
          setMembers((items) =>
            items.map((member) =>
              member.userId === userId
                ? {
                    ...member,
                    nickname: profile.nickname || member.nickname,
                    avatar: profile.headImage || member.avatar,
                  }
                : member,
            ),
          );
        })
        .catch(() => undefined)
        .finally(() => profileRequests.current.delete(userId));
    },
    [currentUser?.id],
  );

  const ensureRtcMember = useCallback(
    (userId: string) => {
      if (!userId || userId === currentUser?.id) return;
      const creatorUserId = String(roomRef.current?.creatorUserId ?? "");
      const serviceUserId = String(roomRef.current?.serviceUserId ?? "");
      setMembers((items) => {
        if (items.some((member) => member.userId === userId)) return items;
        const newMember: VoiceRoomMember = {
          userId,
          nickname: `用户${userId}`,
          role:
            userId === creatorUserId
              ? "owner"
              : userId === serviceUserId
                ? "service"
                : "guest",
          micOpen: false,
        };
        return [
          ...items.filter((member) => member.userId !== "invite"),
          newMember,
          inviteMember,
        ].slice(0, 8);
      });
      hydrateMemberProfile(userId, accessToken || "");
    },
    [accessToken, currentUser?.id, hydrateMemberProfile],
  );

  useEffect(() => () => clearVoiceRtcCallbacks(), []);

  useEffect(() => {
    if (!roomId || !accessToken) {
      return;
    }
    let active = true;
    void (async () => {
      try {
        const detail = await voiceRoomApi.getDetail(roomId, accessToken);
        if (!active) return;
        if (
          invitedRoomVersion &&
          String(detail.roomVersion ?? "1") !== invitedRoomVersion
        ) {
          throw new Error("语聊房已重新开启，请重新获取邀请链接");
        }
        const prepared = await voiceRoomApi.prepareJoin(
          roomId,
          detail.roomVersion ?? "1",
          accessToken,
        );
        if (!active) return;
        setRoom({ ...detail, ...prepared, roomId });
        const preparedMembers = normalizeMembers(
          { ...detail, ...prepared },
          currentUser || undefined,
        );
        setMembers(preparedMembers);
        preparedMembers.forEach((member) =>
          hydrateMemberProfile(member.userId, accessToken),
        );
        await joinVoiceChatRoom(accessToken, prepared.rongChatroomId);
        void getVoiceChatHistory(prepared.rongChatroomId)
          .then((history) => {
            if (!active || history.length === 0) return;
            setMessages((items) => {
              const notices = items.filter((item) => item.kind !== "chat");
              const chatById = new Map<string, VoiceRoomMessage>();
              [
                ...history,
                ...items.filter((item) => item.kind === "chat"),
              ].forEach((message) => {
                chatById.set(message.id, { ...message, kind: "chat" });
              });
              return [
                ...notices,
                ...Array.from(chatById.values()).sort(
                  (left, right) => left.sentAt - right.sentAt,
                ),
              ].slice(-80);
            });
          })
          .catch((cause) =>
            console.warn("[voice-room] history load failed", cause),
          );
        const rtc = await voiceRoomApi.getRtcToken(
          roomId,
          prepared.roomVersion,
          accessToken,
        );
        if (rtc.accessStatus && rtc.accessStatus !== "READY")
          throw new Error("语聊房当前不可加入");
        const token = rtc.token || rtc.rtcToken;
        const channelName =
          rtc.channelName || rtc.rtcChannelName || prepared.rtcChannelName;
        if (!token || !channelName)
          throw new Error("语音频道参数不完整，请稍后重试");
        const rtcJoined = await joinVoiceRtc({
          appId: rtc.appId,
          token,
          channelName,
          uid: Number(rtc.uid || rtc.agoraUid || currentUser?.id || 0),
          callbacks: {
            onUserJoined: (uid) => ensureRtcMember(uid),
            onUserOffline: (uid) =>
              setMembers((items) =>
                items.map((item) =>
                  item.userId === uid
                    ? { ...item, micOpen: false, speaking: false }
                    : item,
                ),
              ),
            onUserMuted: (uid, value) => {
              ensureRtcMember(uid);
              setMembers((items) =>
                items.map((item) =>
                  item.userId === uid ? { ...item, micOpen: !value } : item,
                ),
              );
            },
            onSpeakingChanged: (uids) => {
              uids.forEach(ensureRtcMember);
              setMembers((items) =>
                items.map((item) => ({
                  ...item,
                  speaking: uids.includes(item.userId),
                })),
              );
            },
          },
        });
        if (!rtcJoined) throw new Error("当前设备的语音服务不可用");
        getVoiceRtcRemoteUserIds().forEach(ensureRtcMember);
        setRtcReadyRoomId(roomId);
        setMicState({ roomId, muted: getVoiceRtcMuted() });
        setActiveRoom({
          roomId,
          roomVersion: String(
            prepared.roomVersion ?? detail.roomVersion ?? "1",
          ),
          rongChatroomId: prepared.rongChatroomId,
          roomName: prepared.roomName || detail.roomName || "语聊房",
          creatorUserId: String(detail.creatorUserId ?? ""),
          ownerName:
            String(detail.creatorUserId ?? "") === String(currentUser?.id ?? "")
              ? currentUser?.nickname || "我"
              : "房间成员",
          ownerAvatar:
            String(detail.creatorUserId ?? "") === String(currentUser?.id ?? "")
              ? currentUser?.headImage
              : undefined,
        });
        setError(null);
      } catch (cause) {
        if (active)
          setError(cause instanceof Error ? cause.message : "进入语聊房失败");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [
    accessToken,
    currentUser,
    ensureRtcMember,
    hydrateMemberProfile,
    invitedRoomVersion,
    roomId,
    setActiveRoom,
  ]);

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
        if (action.actionType === 1)
          hydrateMemberProfile(userId, accessToken || "");
      });
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
    currentUser?.id,
    hydrateMemberProfile,
    room?.creatorUserId,
    room?.serviceUserId,
  ]);

  const minimize = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

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
    setInput("");
    const local = {
      id: `local-${Date.now()}`,
      nickname: currentUser?.nickname || "我",
      text,
      sentAt: Date.now(),
      kind: "chat" as const,
    };
    setMessages((items) => [...items, local].slice(-80));
    if (chatroomId)
      await sendVoiceChatMessage(chatroomId, text).catch(() =>
        Alert.alert("发送失败", "请稍后重试"),
      );
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
      Alert.alert(
        "需要麦克风权限",
        "请在系统设置中允许盼之电竞使用麦克风后再开麦。",
        [
          { text: "取消", style: "cancel" },
          { text: "去设置", onPress: () => void Linking.openSettings() },
        ],
      );
      return false;
    }

    return await new Promise<boolean>((resolve) => {
      Alert.alert(
        "需要麦克风权限",
        "开麦需要使用麦克风，请允许盼之电竞访问麦克风。",
        [
          { text: "取消", style: "cancel", onPress: () => resolve(false) },
          {
            text: "去授权",
            onPress: () => {
              void (async () => {
                try {
                  const permission = await requestRecordingPermissionsAsync();
                  if (permission.granted) {
                    resolve(true);
                    return;
                  }
                  if (!permission.canAskAgain) {
                    Alert.alert(
                      "麦克风权限已关闭",
                      "请在系统设置中允许盼之电竞使用麦克风后再开麦。",
                      [
                        { text: "取消", style: "cancel" },
                        {
                          text: "去设置",
                          onPress: () => void Linking.openSettings(),
                        },
                      ],
                    );
                  }
                } catch {
                  // The caller keeps the room in listen-only mode when permission cannot be requested.
                }
                resolve(false);
              })();
            },
          },
        ],
      );
    });
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
      Toast.show(next ? "已闭麦" : "已开麦", { duration: Toast.durations.SHORT });
    } catch {
      Toast.show("麦克风不可用，当前可以听到房间语音，请检查设备或权限", {
        duration: Toast.durations.SHORT,
      });
    } finally {
      setMicChanging(false);
    }
  };

  const callService = async () => {
    if (!roomId || !accessToken || serviceCalling) return;
    if (!room?.clubId) {
      Alert.alert("客服派单", "当前房间暂未绑定俱乐部客服。");
      return;
    }
    setServiceCalling(true);
    try {
      await voiceRoomApi.inviteClubService(
        roomId,
        roomVersion,
        room.clubId,
        accessToken,
      );
      Alert.alert("客服派单", "已呼叫俱乐部接待，请稍候。");
    } catch (cause) {
      Alert.alert(
        "客服派单失败",
        cause instanceof Error ? cause.message : "请稍后重试",
      );
    } finally {
      setServiceCalling(false);
    }
  };

  const copyInviteLink = async () => {
    if (!roomId || !room) {
      Toast.show("房间信息加载中，请稍后再试", {
        duration: Toast.durations.SHORT,
      });
      return;
    }
    const inviteLink = `https://djpc.jlgkj.top/chat?type=chat-room&id=${encodeURIComponent(roomId)}&v=${encodeURIComponent(String(room.roomVersion ?? "1"))}`;
    try {
      await Clipboard.setStringAsync(inviteLink);
      Toast.show("邀请链接已复制，去发给好友吧", {
        duration: Toast.durations.SHORT,
      });
    } catch {
      Toast.show("复制失败，请手动复制", { duration: Toast.durations.SHORT });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <Image
        source={background}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="收起语聊房"
            onPress={minimize}
            disabled={leaving}
            hitSlop={12}
            style={styles.headerButton}
          >
            <Image source={backIcon} style={styles.headerIcon} />
          </Pressable>
          <Text style={styles.title}>{roomTitle}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isOwner ? "解散语聊房" : "退出语聊房"}
            disabled={loading || !room || leaving}
            onPress={() => {
              Keyboard.dismiss();
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

        <View style={styles.grid}>
          {members.map((member, index) => {
            const invite = member.userId === "invite";
            const ring = invite
              ? ringInvite
              : member.role === "owner"
                ? ringOwner
                : undefined;
            const micOpen =
              rtcReady &&
              (member.userId === String(currentUser?.id)
                ? !muted
                : Boolean(member.micOpen));
            const speaking = micOpen && Boolean(member.speaking);
            return (
              <Pressable
                key={`${member.userId}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={
                  invite
                    ? "邀请用户"
                    : `查看${member.nickname}的资料，${micOpen ? "已开麦" : "已闭麦"}${speaking ? "，正在说话" : ""}`
                }
                style={[
                  styles.memberSlot,
                  { width: `${100 / memberColumns}%` },
                ]}
                onPress={
                  invite
                    ? () => void copyInviteLink()
                    : () => {
                        Keyboard.dismiss();
                        setSelectedMember(member);
                        setMemberSheetVisible(true);
                      }
                }
              >
                <View
                  style={[styles.avatarWrap, speaking && styles.avatarSpeaking]}
                >
                  {ring ? <Image source={ring} style={styles.ring} /> : null}
                  {invite ? (
                    <Image source={ringInvite} style={styles.inviteRing} />
                  ) : (
                    <Image
                      source={avatarSource(member)}
                      style={styles.avatar}
                    />
                  )}
                  {!invite ? (
                    <VoiceRoomMicBadge muted={!micOpen} speaking={speaking} />
                  ) : null}
                  {invite ? (
                    <Image source={inviteIcon} style={styles.inviteBadge} />
                  ) : null}
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.memberName, invite && styles.inviteName]}
                >
                  {invite ? "邀请用户" : member.nickname}
                </Text>
                {member.role === "owner" ? (
                  <Text style={styles.roleLabel}>房主</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.chatPanel}>
          {loading ? (
            <ActivityIndicator color="#B8C5FF" style={styles.loading} />
          ) : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => displayMessage(item)}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
          />
        </View>

        <VoiceRoomToolbar
          bottomInset={insets.bottom}
          input={input}
          muted={muted}
          rtcReady={rtcReady}
          connecting={loading}
          micChanging={micChanging}
          leaving={leaving}
          serviceCalling={serviceCalling}
          onChangeText={setInput}
          onSend={() => void sendMessage()}
          onToggleMute={() => void toggleMute()}
          onOpenMessages={() => {
            Keyboard.dismiss();
            router.navigate("/(tabs)/message");
          }}
          onInvite={() => void copyInviteLink()}
          onCallService={() => void callService()}
        />
      </View>
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
      <VoiceRoomMemberSheet
        visible={memberSheetVisible}
        member={
          members.find((member) => member.userId === selectedMember?.userId) ??
          selectedMember
        }
        room={room}
        roomId={roomId}
        onClose={() => setMemberSheetVisible(false)}
        onMemberKicked={(userId) => {
          setMembers((items) =>
            items.filter((member) => member.userId !== userId),
          );
          if (selectedMember?.userId === userId) setMemberSheetVisible(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#080B25" },
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
  headerIcon: { width: 22, height: 22 },
  title: { color: "#F6F7FF", fontSize: 17, fontWeight: "700" },
  roomMeta: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 12 },
  roomName: { color: "#F7F8FF", fontSize: 16, fontWeight: "700" },
  roomId: { color: "#9296B3", fontSize: 11, marginTop: 5 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    height: 381,
    alignItems: "center",
    alignContent: "center",
    justifyContent: "center",
    rowGap: 12,
  },
  memberSlot: { alignItems: "center", minHeight: 103 },
  avatarWrap: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 29,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  avatarSpeaking: {
    backgroundColor: "rgba(57,200,120,0.18)",
    borderColor: "#39C878",
    shadowColor: "#39C878",
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  ring: { position: "absolute", width: 58, height: 58 },
  inviteRing: { position: "absolute", width: 58, height: 58 },
  inviteBadge: { width: 22, height: 22 },
  memberName: {
    color: "#F0F1FF",
    fontSize: 11,
    maxWidth: 76,
    marginTop: 7,
    textAlign: "center",
  },
  inviteName: { color: "#A9B2E9" },
  roleLabel: { color: "#D3A2FF", fontSize: 9, marginTop: 2 },
  chatPanel: {
    flex: 1,
    marginTop: 8,
    marginHorizontal: 16,
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
    justifyContent: "flex-end",
    paddingTop: 12,
    paddingBottom: 10,
  },
  noticeText: {
    color: "#9EA7D1",
    fontSize: 12,
    lineHeight: 20,
    marginBottom: 8,
  },
  messageRow: { flexDirection: "row", marginBottom: 8, paddingRight: 12 },
  messageName: { color: "#B892FF", fontSize: 12, marginRight: 6 },
  messageBody: { color: "#E9EAF5", fontSize: 12, flex: 1, lineHeight: 18 },
});
