import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { reconcileMembers } from "./member-normalize";
import type { VoiceRoomMember } from "./voice-room.types";
import { voiceRoomApi } from "./voice-room.api";
import { subscribeVoiceChatConnection } from "./voice-room-rongcloud";

/** 融云重连与回前台可能连续触发，与 join 时的 detail 拉取共用最小间隔 */
const RECONCILE_MIN_INTERVAL_MS = 5_000;

type ReconcileCurrentUser = {
  id: string;
  nickname?: string;
  headImage?: string;
};

type VoiceRoomMembersReconcileOptions = {
  roomId?: string;
  accessToken?: string | null;
  currentUser?: ReconcileCurrentUser | null;
  roomRef: { current: { roomVersion: string | number } | null };
  kickedRef: { current: boolean };
  hydrateMemberProfile: (userId: string, token: string) => void;
  setMembers: (updater: (items: VoiceRoomMember[]) => VoiceRoomMember[]) => void;
};

/**
 * 融云聊天室成员变更事件不存离线：断网/重连期间漏掉的退出事件会让成员永久残留。
 * 回前台和融云重连时重拉 detail，用后端权威名单校准本地列表。
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

  // 进房流程已拉过一次 detail，挂载后先压制 5s 内的重连触发，避免紧跟着 join 的重复请求
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
    lastAttemptAtRef.current = now;
    inFlightRef.current = true;
    const token = accessToken;
    void (async () => {
      try {
        const detail = await voiceRoomApi.getDetail(roomId, token);
        const currentVersion = roomRef.current?.roomVersion;
        // 房间已重建：名单归属新实例，不能用新实例成员覆盖旧聊天室视图
        if (
          currentVersion != null &&
          String(detail.roomVersion ?? "1") !== String(currentVersion)
        ) {
          return;
        }
        setMembers((items) => reconcileMembers(items, detail, currentUser ?? undefined));
        (detail.members || []).forEach((member) => {
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
}
