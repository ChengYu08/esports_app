import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { useUserProfileStore, type CachedUserProfile } from "@/features/auth/user-profile-store";
import { showToast } from "@/shared/ui/app-toast";

import { promptSelfRealNameIfNeeded } from "./ensure-real-name-before-enter";
import {
  buildMemberChangeMessage,
  memberChangeNoticeKey,
  resolveMemberChangeNickname,
  shouldSkipMemberChangeNotice,
} from "./member-change-notice";
import {
  applyChatRoomMemberActions,
  inviteMember,
  normalizeMembers,
  reconcileMembers,
} from "./member-normalize";
import type { ActiveVoiceRoom } from "./voice-room-session";
import { useVoiceRoomSessionStore } from "./voice-room-session";
import {
  getVoiceChatHistory,
  joinVoiceChatRoom,
  leaveVoiceChatRoom,
  subscribeVoiceChatMembers,
} from "./voice-room-rongcloud";
import {
  clearVoiceRtcCallbacks,
  getVoiceRtcMuted,
  getVoiceRtcRemoteUserIds,
  joinVoiceRtc,
  leaveVoiceRtc,
} from "./voice-room-rtc";
import { voiceRoomApi } from "./voice-room.api";
import type {
  VoiceRoomDetail,
  VoiceRoomMember,
  VoiceRoomMessage,
} from "./voice-room.types";

const mergeMemberProfiles = (items: VoiceRoomMember[], profiles: CachedUserProfile[]) => {
  if (profiles.length === 0) return items;
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  return items.map((member) => {
    const profile = byId.get(member.userId);
    if (!profile) return member;
    return {
      ...member,
      nickname: profile.nickname || member.nickname,
      avatar: profile.headImage || member.avatar,
    };
  });
};

export interface UseVoiceRoomRtcOptions {  roomId: string | undefined;
  accessToken: string | null;
  currentUser: { id: string; nickname?: string; headImage?: string } | null;
  room: VoiceRoomDetail | null;
  invitedRoomVersion: string | undefined;
  routeScene: string | undefined;
  routeRequestNo: string | undefined;
  routeExpireTime: string | undefined;
  routeGameId: string | undefined;
  routeGameName: string | undefined;
  routeGameIconUrl: string | undefined;
  kickedRef: { current: boolean };
  setRoom: Dispatch<SetStateAction<VoiceRoomDetail | null>>;
  setMembers: Dispatch<SetStateAction<VoiceRoomMember[]>>;
  setMessages: Dispatch<SetStateAction<VoiceRoomMessage[]>>;
}

export function useVoiceRoomRtc(options: UseVoiceRoomRtcOptions) {
  const {
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
  } = options;
  const [rtcReadyRoomId, setRtcReadyRoomId] = useState<string | null>(null);
  // 独立于 members 的说话人 uid 集合，声网音量回调高频更新。
  // 之所以不放在 members 属性里，是规避 React Compiler 对深层对象属性更新
  // 追踪失灵导致的高频更新不重渲染问题（远端说话时 members 变了但麦位不刷新）
  const [speakingUserIds, setSpeakingUserIds] = useState<string[]>([]);
  // 每个说话人最后一次检测到说话的时间戳，用于迟滞判断
  const speakingLastAtRef = useRef<Record<string, number>>({});
  // 迟滞定时器，说话停止后延迟移除
  const speakingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [micState, setMicState] = useState<{
    roomId: string;
    muted: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(() => Boolean(roomId && accessToken));
  const [error, setError] = useState<string | null>(() =>
    !roomId ? "语聊房不存在" : !accessToken ? "请先登录后进入语聊房" : null,
  );
  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const hydrateMemberProfiles = useCallback(
    (userIds: string[], token: string) => {
      if (!token) return;
      const ids = userIds.filter((id) => id && id !== currentUser?.id);
      if (ids.length === 0) return;
      // 已缓存条目立即合并（消首帧占位闪烁），缺失部分走批量接口后合并
      const { cached, missing } = useUserProfileStore.getState().splitByCache(ids);
      if (cached.length > 0) {
        setMembers((items) => mergeMemberProfiles(items, cached));
      }
      if (missing.length === 0) return;
      void useUserProfileStore
        .getState()
        .hydrateProfiles(missing, token)
        .then((fetched) => {
          if (fetched.length > 0) {
            setMembers((items) => mergeMemberProfiles(items, fetched));
          }
        });
    },
    [currentUser?.id, setMembers],
  );

  const ensureRtcMember = useCallback(
    (userId: string) => {
      // uid "0" 是 joinChannel 传 0 时 Agora 在音量回调里返回的本地占位 uid，不是真实用户
      if (!userId || userId === "0" || userId === currentUser?.id) return;
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
        ];
      });
      hydrateMemberProfiles([userId], accessToken || "");
    },
    [accessToken, currentUser?.id, hydrateMemberProfiles, setMembers],
  );

  // 对齐 PC（onImRoomReady → getChatRoomInfo 全量快照）：进房 detail 不含成员，
  // join 期间加入/离开的成员既不在名单里也收不到事件（聊天室事件不存离线）。
  // RC join 确认后拉取专用成员快照端点校准，并记录请求窗口内到达的成员事件、
  // 合并后重放，防止权威覆盖把窗口内的变更脉冲冲掉。
  const reconcileMembersAfterJoin = useCallback(
    (rongChatroomId: string) => {
      if (!roomId || !accessToken || kickedRef.current) return;
      const roomVersion = roomRef.current?.roomVersion;
      if (roomVersion == null) return;
      const snapshotActions: { userId?: string; actionType?: number }[] = [];
      const stopCapture = subscribeVoiceChatMembers((targetId, actions) => {
        if (targetId === rongChatroomId) snapshotActions.push(...actions);
      });
      void (async () => {
        try {
          const snapshot = await voiceRoomApi.getRoomMembers(roomId, roomVersion, accessToken);
          if (kickedRef.current) return;
          // 请求期间房间已重建：名单归属新实例，不能用新实例成员覆盖当前聊天室视图
          if (String(roomRef.current?.roomVersion ?? "") !== String(roomVersion)) {
            return;
          }
          const room = roomRef.current;
          const selfId = currentUser?.id ? String(currentUser.id) : "";
          setMembers((items) =>
            applyChatRoomMemberActions(
              reconcileMembers(
                items,
                {
                  roomVersion: snapshot.roomVersion,
                  creatorUserId: room?.creatorUserId,
                  serviceUserId: room?.serviceUserId,
                  members: snapshot.members,
                },
                currentUser ?? undefined,
              ),
              snapshotActions,
              {
                selfId,
                creatorUserId: room?.creatorUserId,
                serviceUserId: room?.serviceUserId,
              },
            ),
          );
          const memberIds = snapshot.members
            .map((member) => (member.userId == null ? "" : String(member.userId)))
            .filter((userId) => userId && userId !== selfId);
          hydrateMemberProfiles(memberIds, accessToken);
        } catch (cause) {
          console.warn("[voice-room] post-join member reconcile failed", cause);
        } finally {
          stopCapture();
        }
      })();
    },
    [accessToken, currentUser, hydrateMemberProfiles, kickedRef, roomId, setMembers],
  );

  useEffect(() => () => clearVoiceRtcCallbacks(), []);

  useEffect(() => {
    if (!roomId || !accessToken) {
      return;
    }
    if (kickedRef.current) return;
    let active = true;
    let joining: ActiveVoiceRoom | null = null;
    const isCurrentJoin = () => active && !kickedRef.current
      && (!joining || useVoiceRoomSessionStore.getState().joiningRoom === joining);
    const cleanupCancelledJoin = async () => {
      if (!joining) return;
      const state = useVoiceRoomSessionStore.getState();
      // Never tear down a newer room that took over while an old request waited.
      const currentRoom = state.joiningRoom && state.joiningRoom !== joining
        ? state.joiningRoom : state.activeRoom;
      if (currentRoom?.rongChatroomId === joining.rongChatroomId) return;
      await Promise.allSettled([
        ...(currentRoom ? [] : [leaveVoiceRtc()]),
        leaveVoiceChatRoom(joining.rongChatroomId),
      ]);
    };
    void (async () => {
      try {
        const detail = await voiceRoomApi.getDetail(roomId, accessToken);
        if (!isCurrentJoin()) return;
        // 对齐 PC：路由携带的邀请 v 与当前实例不一致则拒绝进房（勿静默升版本）
        if (
          invitedRoomVersion &&
          String(detail.roomVersion ?? "1") !== invitedRoomVersion
        ) {
          showToast("该邀请已失效");
          setError("该邀请已失效");
          return;
        }
        const prepared = await voiceRoomApi.prepareJoin(
          roomId,
          detail.roomVersion ?? "1",
          accessToken,
        );
        if (!isCurrentJoin()) return;
        const prevRoom = useVoiceRoomSessionStore.getState().activeRoom;
        const prevAudition =
          prevRoom?.roomId === roomId && prevRoom.scene === "audition"
            ? prevRoom
            : null;
        const prevQuickMatchCreated =
          prevRoom?.roomId === roomId && prevRoom.scene === "quickMatchCreated"
            ? prevRoom
            : null;
        // 路由试音优先；否则保留 session 上的 audition / quickMatchCreated 标记，避免进房覆盖丢失
        const preservedMatch =
          routeScene === "audition" || prevAudition
            ? {
                scene: "audition" as const,
                matchRequestNo:
                  routeRequestNo || prevAudition?.matchRequestNo || undefined,
                matchExpireTime:
                  routeExpireTime || prevAudition?.matchExpireTime || undefined,
                matchGameId: routeGameId || prevAudition?.matchGameId || undefined,
                matchGameName:
                  routeGameName || prevAudition?.matchGameName || undefined,
                matchGameIconUrl:
                  routeGameIconUrl || prevAudition?.matchGameIconUrl || undefined,
              }
            : prevQuickMatchCreated?.matchRequestNo
              ? {
                  scene: "quickMatchCreated" as const,
                  matchRequestNo: prevQuickMatchCreated.matchRequestNo,
                  matchExpireTime: prevQuickMatchCreated.matchExpireTime,
                  matchGameId: prevQuickMatchCreated.matchGameId,
                  matchGameName: prevQuickMatchCreated.matchGameName,
                  matchGameIconUrl: prevQuickMatchCreated.matchGameIconUrl,
                }
              : null;
        joining = {
          roomId,
          roomVersion: String(prepared.roomVersion ?? detail.roomVersion ?? "1"),
          rongChatroomId: prepared.rongChatroomId,
          roomName: prepared.roomName || detail.roomName || "语聊房",
          creatorUserId: String(detail.creatorUserId ?? ""),
          ownerName: String(detail.creatorUserId ?? "") === String(currentUser?.id ?? "")
            ? currentUser?.nickname || "我" : "房间成员",
          ownerAvatar: String(detail.creatorUserId ?? "") === String(currentUser?.id ?? "")
            ? currentUser?.headImage : undefined,
          ...(preservedMatch?.matchRequestNo
            ? {
                scene: preservedMatch.scene,
                matchRequestNo: preservedMatch.matchRequestNo,
                matchExpireTime: preservedMatch.matchExpireTime,
                matchGameId: preservedMatch.matchGameId,
                matchGameName: preservedMatch.matchGameName,
                matchGameIconUrl: preservedMatch.matchGameIconUrl,
              }
            : {}),
        };
        useVoiceRoomSessionStore.getState().beginRoomJoin(joining);
        setRoom({ ...detail, ...prepared, roomId });
        const preparedMembers = normalizeMembers(
          { ...detail, ...prepared },
          currentUser || undefined,
        );
        setMembers(preparedMembers);
        hydrateMemberProfiles(
          preparedMembers.map((member) => member.userId),
          accessToken,
        );
        await joinVoiceChatRoom(accessToken, prepared.rongChatroomId);
        if (!isCurrentJoin()) { await cleanupCancelledJoin(); return; }
        void reconcileMembersAfterJoin(prepared.rongChatroomId);
        if (currentUser?.id) {
          const selfId = String(currentUser.id);
          const noticeKey = memberChangeNoticeKey(
            roomId,
            prepared.roomVersion,
            selfId,
          );
          if (!shouldSkipMemberChangeNotice(noticeKey, "join")) {
            const { nickname } = resolveMemberChangeNickname({
              userId: selfId,
              members: preparedMembers,
              currentUser,
            });
            const selfJoinTip = buildMemberChangeMessage({
              roomId,
              roomVersion: prepared.roomVersion,
              userId: selfId,
              nickname,
              action: "join",
              createdAt: Date.now() + 1,
            });
            setMessages((items) => [...items, selfJoinTip].slice(-80));
          }
        }
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
        if (!isCurrentJoin()) { await cleanupCancelledJoin(); return; }
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
            onRemoteAudioActive: (uid) => {
              // 进房晚于对方开麦时收不到 mute 广播，音频流到达即说明对方已开麦
              ensureRtcMember(uid);
              setMembers((items) =>
                items.map((item) =>
                  item.userId === uid && !item.micOpen
                    ? { ...item, micOpen: true }
                    : item,
                ),
              );
            },
            onSpeakingChanged: (uids) => {
              uids.forEach(ensureRtcMember);
              const selfId = String(currentUser?.id ?? "");
              // 声网音量回调里本地说话人的 uid 恒为 "0"（Agora AudioVolumeInfo 约定），
              // 命中即自己在说话；远端说话人按真实 userId 匹配
              const speakingIds = uids.map((uid) =>
                uid === "0" ? selfId : uid,
              );
              const now = Date.now();
              // 记录每个说话人最后一次检测到说话的时间
              speakingIds.forEach((id) => {
                speakingLastAtRef.current[id] = now;
              });
              // 迟滞判断：500ms 内检测到说话即视为持续发言，避免 200ms 音量震荡导致光环闪烁
              const activeIds = Object.entries(speakingLastAtRef.current)
                .filter(([, lastAt]) => now - lastAt < 500)
                .map(([id]) => id);
              // 内容不变时不更新，避免 200ms 高频回调触发无效重渲染
              setSpeakingUserIds((prev) =>
                prev.length === activeIds.length &&
                prev.every((id) => activeIds.includes(id))
                  ? prev
                  : activeIds,
              );
              // 为刚停止说话的人安排延迟清理
              Object.keys(speakingLastAtRef.current).forEach((id) => {
                const lastAt = speakingLastAtRef.current[id];
                if (now - lastAt < 500) return;
                if (speakingTimersRef.current[id]) return;
                speakingTimersRef.current[id] = setTimeout(() => {
                  delete speakingTimersRef.current[id];
                  delete speakingLastAtRef.current[id];
                  setSpeakingUserIds((prev) => prev.filter((v) => v !== id));
                }, 500);
              });
              // 远端说话人必然开着麦，兜底纠正进房前漏掉的 mute 状态。
              // 无 micOpen 翻转时返回原数组，避免 5Hz 音量回调触发整屏重渲染。
              setMembers((items) => {
                let changed = false;
                const next = items.map((item) => {
                  if (
                    item.userId !== selfId &&
                    speakingIds.includes(item.userId) &&
                    !item.micOpen
                  ) {
                    changed = true;
                    return { ...item, micOpen: true };
                  }
                  return item;
                });
                return changed ? next : items;
              });
            },
          },
        });
        if (!isCurrentJoin()) { await cleanupCancelledJoin(); return; }
        if (!rtcJoined) throw new Error("当前设备的语音服务不可用");
        if (!useVoiceRoomSessionStore.getState().completeRoomJoin(joining)) return;
        getVoiceRtcRemoteUserIds().forEach(ensureRtcMember);
        setRtcReadyRoomId(roomId);
        setMicState({ roomId, muted: getVoiceRtcMuted() });
        setError(null);
      } catch (cause) {
        await cleanupCancelledJoin();
        if (active && !kickedRef.current) {
          const message =
            cause instanceof Error ? cause.message : "进入语聊房失败";
          await promptSelfRealNameIfNeeded(message);
          setError(message);
        }
      } finally {
        if (joining) useVoiceRoomSessionStore.getState().cancelRoomJoin(joining);
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      if (joining) useVoiceRoomSessionStore.getState().cancelRoomJoin(joining);
      // 清理迟滞定时器和说话人状态
      Object.values(speakingTimersRef.current).forEach(clearTimeout);
      speakingTimersRef.current = {};
      speakingLastAtRef.current = {};
      setSpeakingUserIds([]);
    };
  }, [
    accessToken,
    currentUser,
    ensureRtcMember,
    hydrateMemberProfiles,
    invitedRoomVersion,
    kickedRef,
    reconcileMembersAfterJoin,
    roomId,
    setMembers,
    setMessages,
    setRoom,
  ]);

  const rtcReady = Boolean(roomId && rtcReadyRoomId === roomId);
  const muted = !roomId || micState?.roomId !== roomId || micState.muted;

  return {
    loading,
    error,
    rtcReady,
    muted,
    micState,
    setMicState,
    setRtcReadyRoomId,
    speakingUserIds,
    hydrateMemberProfiles,
    roomRef,
  };
}
