import { useAuthStore } from "@esports/auth";
import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { resolveVoiceRoomId, voiceRoomApi } from "./voice-room.api";
import type { VoiceRoomDetail } from "./voice-room.types";
import {
  useVoiceRoomSessionStore,
  type ActiveVoiceRoom,
} from "./voice-room-session";

/** 前台 / 轮询 / 登录共用的最小请求间隔 */
export const JOINED_SYNC_MIN_INTERVAL_MS = 10_000;
/** 本地有 activeRoom 且在前台时的轮询间隔 */
export const JOINED_SYNC_POLL_INTERVAL_MS = 60_000;

type SyncJoinedVoiceRoomOptions = {
  force?: boolean;
  token?: string | null;
};

let lastAttemptAt = 0;
let inFlight: Promise<void> | null = null;

/** 测试用：重置节流与单飞状态 */
export function resetJoinedVoiceRoomSyncState() {
  lastAttemptAt = 0;
  inFlight = null;
}

function mapJoinedToActiveRoom(
  detail: VoiceRoomDetail,
  roomId: string,
  current: ActiveVoiceRoom | null,
): ActiveVoiceRoom {
  const user = useAuthStore.getState().user;
  const creatorUserId = String(
    detail.creatorUserId ?? current?.creatorUserId ?? "",
  );
  const isOwner =
    Boolean(user?.id) && creatorUserId === String(user?.id ?? "");
  const base: ActiveVoiceRoom = {
    roomId,
    roomVersion: String(detail.roomVersion ?? current?.roomVersion ?? "1"),
    rongChatroomId: detail.rongChatroomId ?? current?.rongChatroomId ?? "",
    roomName: detail.roomName || current?.roomName || "语聊房",
    creatorUserId,
    ownerName: isOwner
      ? user?.nickname || current?.ownerName || "我"
      : current?.roomId === roomId
        ? current.ownerName
        : "房间成员",
    ownerAvatar: isOwner
      ? user?.headImage || current?.ownerAvatar
      : current?.roomId === roomId
        ? current.ownerAvatar
        : undefined,
  };

  if (current?.roomId !== roomId) return base;

  return {
    ...base,
    scene: current.scene,
    matchRequestNo: current.matchRequestNo,
    matchExpireTime: current.matchExpireTime,
    matchGameId: current.matchGameId,
    matchGameName: current.matchGameName,
    matchGameIconUrl: current.matchGameIconUrl,
  };
}

function applyJoinedRoom(detail: VoiceRoomDetail) {
  const roomId = resolveVoiceRoomId(detail);
  if (!roomId) {
    const active = useVoiceRoomSessionStore.getState().activeRoom;
    if (active) useVoiceRoomSessionStore.getState().clearActiveRoom(active.roomId);
    return;
  }

  const current = useVoiceRoomSessionStore.getState().activeRoom;
  useVoiceRoomSessionStore
    .getState()
    .setActiveRoom(mapJoinedToActiveRoom(detail, roomId, current));
}

/**
 * 以 joined/current 校正本地 activeRoom（悬浮球多端同步）。
 * 无房仅清会话；失败保持本地；进房中不打断。
 */
export function syncJoinedVoiceRoom(
  options: SyncJoinedVoiceRoomOptions = {},
): Promise<void> {
  const token = options.token ?? useAuthStore.getState().accessToken;
  if (!token) return Promise.resolve();

  const now = Date.now();
  if (!options.force && now - lastAttemptAt < JOINED_SYNC_MIN_INTERVAL_MS) {
    return inFlight ?? Promise.resolve();
  }
  if (inFlight) return inFlight;

  lastAttemptAt = now;
  inFlight = (async () => {
    try {
      const joined = await voiceRoomApi.getJoinedRoom(token);
      if (useAuthStore.getState().accessToken !== token) return;

      const { activeRoom, joiningRoom, clearActiveRoom } =
        useVoiceRoomSessionStore.getState();
      if (joiningRoom) return;

      const joinedId = resolveVoiceRoomId(joined);
      if (!joined || !joinedId) {
        if (activeRoom) clearActiveRoom(activeRoom.roomId);
        return;
      }
      applyJoinedRoom(joined);
    } catch {
      // 网络失败保持本地，避免抖动误清悬浮
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

type VoiceRoomJoinedSyncHostProps = {
  /** 须在同意隐私协议后为 true */
  enabled: boolean;
};

/**
 * 根布局挂载：隐私同意后启用；登录 force、回前台节流、有房时 60s 轮询。
 */
export function VoiceRoomJoinedSyncHost({
  enabled,
}: VoiceRoomJoinedSyncHostProps) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const activeRoomId = useVoiceRoomSessionStore(
    (state) => state.activeRoom?.roomId ?? null,
  );
  const [appActive, setAppActive] = useState(
    () => AppState.currentState === "active",
  );

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      setAppActive(state === "active");
      if (!enabled || !accessToken || state !== "active") return;
      void syncJoinedVoiceRoom({ token: accessToken });
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [accessToken, enabled]);

  useEffect(() => {
    if (!enabled || !accessToken) return;
    void syncJoinedVoiceRoom({ force: true, token: accessToken });
  }, [accessToken, enabled]);

  useEffect(() => {
    if (!enabled || !accessToken || !activeRoomId || !appActive) return;
    const timer = setInterval(() => {
      void syncJoinedVoiceRoom({ token: accessToken });
    }, JOINED_SYNC_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [accessToken, activeRoomId, appActive, enabled]);

  return null;
}
