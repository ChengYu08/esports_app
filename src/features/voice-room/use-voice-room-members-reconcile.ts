import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { reconcileMembers } from "./member-normalize";
import type { VoiceRoomMember } from "./voice-room.types";
import { voiceRoomApi } from "./voice-room.api";
import { subscribeVoiceChatConnection } from "./voice-room-rongcloud";

/** 融云重连与回前台可能连续触发，与 join 时的 detail 拉取共用最小间隔 */
const RECONCILE_MIN_INTERVAL_MS = 5_000;
// 对齐 PC 端 useRtcRecovery 的 30s watchdog：漏掉的成员事件没有别的推送来源，
// 周期对账是最终的兜底手段
const RECONCILE_WATCHDOG_INTERVAL_MS = 30_000;

type ReconcileCurrentUser = {
  id: string;
  nickname?: string;
  headImage?: string;
};

type ReconcileRoomRef = {
  current: {
    roomVersion?: string | number;
    creatorUserId?: string | number;
    serviceUserId?: string | number;
  } | null;
};

type VoiceRoomMembersReconcileOptions = {
  roomId?: string;
  accessToken?: string | null;
  currentUser?: ReconcileCurrentUser | null;
  roomRef: ReconcileRoomRef;
  kickedRef: { current: boolean };
  hydrateMemberProfile: (userId: string, token: string) => void;
  setMembers: (updater: (items: VoiceRoomMember[]) => VoiceRoomMember[]) => void;
};

/**
 * 融云聊天室成员变更事件不存离线：断网/重连期间漏掉的退出事件会让成员永久残留。
 * 回前台、融云重连与 30s watchdog 时重拉成员快照，用后端权威名单校准本地列表。
 * 数据源为专用 members 端点（detail 从不返回成员）；任何失败都跳过本次对账，不清空列表。
 */
export function useVoiceRoomMembersReconcile({
  roomId,
  accessToken,
  currentUser,
  roomRef,
  kickedRef,
  hydrateMemberProfile,
  setMembers,
}: VoiceRoomMembersReconcileOptions) {
  const lastAttemptAtRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  // 进房流程已对账过一次，挂载后先压制 5s 内的重连触发，避免紧跟着 join 的重复请求
  useEffect(() => {
    lastAttemptAtRef.current = Date.now();
  }, []);

  const reconcile = useCallback(() => {
    if (!roomId || !accessToken || kickedRef.current) {
      return;
    }
    const now = Date.now();
    const lastAttemptAt = lastAttemptAtRef.current;
    if (lastAttemptAt != null && now - lastAttemptAt < RECONCILE_MIN_INTERVAL_MS) {
      return;
    }
    if (inFlightRef.current) {
      return;
    }
    const roomVersion = roomRef.current?.roomVersion;
    if (roomVersion == null) {
      return;
    }
    lastAttemptAtRef.current = now;
    inFlightRef.current = true;
    const token = accessToken;
    void (async () => {
      try {
        const snapshot = await voiceRoomApi.getRoomMembers(roomId, roomVersion, token);
        if (kickedRef.current) return;
        // 请求期间房间已重建：名单归属新实例，不能用新实例成员覆盖旧聊天室视图
        if (String(roomRef.current?.roomVersion ?? "") !== String(roomVersion)) {
          return;
        }
        const room = roomRef.current;
        setMembers((items) =>
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
        );
        snapshot.members.forEach((member) => {
          const userId = member.userId == null ? "" : String(member.userId);
          if (userId && userId !== currentUser?.id) {
            hydrateMemberProfile(userId, token);
          }
        });
      } catch (cause) {
        console.warn("[voice-room] member reconcile failed", cause);
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [
    accessToken,
    currentUser,
    hydrateMemberProfile,
    kickedRef,
    roomId,
    roomRef,
    setMembers,
  ]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        reconcile();
      }
    });
    return () => sub.remove();
  }, [reconcile]);

  useEffect(() => {
    if (!roomId) {
      return;
    }
    const unsubscribe = subscribeVoiceChatConnection((connected) => {
      if (connected) {
        reconcile();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [reconcile, roomId]);

  useEffect(() => {
    if (!roomId) {
      return;
    }
    const timer = setInterval(reconcile, RECONCILE_WATCHDOG_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [reconcile, roomId]);
}
