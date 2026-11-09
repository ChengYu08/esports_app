import { router } from "expo-router";

import { messageStore } from "@/features/message/message-store";
import { sendRongText } from "@/features/message/rongcloud-im";
import { resolveVoiceRoomId, voiceRoomApi } from "@/features/voice-room/voice-room.api";
import { navigateToVoiceRoom } from "@/features/voice-room/navigate-voice-room";
import { showToast } from "@/shared/ui/app-toast";
import { useAuthStore } from "@esports/auth";

/** 支付成功后发给陪玩的固定文案（对齐 PC / 匹配页） */
export const ORDER_PAID_NOTIFY_TEXT = "我已支付订单~";

const READY_POLL_INTERVAL_MS = 100;
const READY_POLL_MAX_ATTEMPTS = 50; // 最多约 5s
const REINIT_EVERY_ATTEMPTS = 5;

async function waitUntilMessageReady(
  accessToken: string | null,
): Promise<boolean> {
  if (!accessToken) {
    return false;
  }

  if (messageStore.getState().connectionState === "ready") {
    return true;
  }

  // 可能已有 initialize 在进行（initializeInProgress 时会直接 return），需轮询等到 ready
  await messageStore.getState().initialize(accessToken).catch(() => {});

  for (let attempt = 0; attempt < READY_POLL_MAX_ATTEMPTS; attempt += 1) {
    if (messageStore.getState().connectionState === "ready") {
      return true;
    }
    // 卡在 idle/error 时周期性再触发；connecting 时 initialize 会早退，继续等
    if (attempt > 0 && attempt % REINIT_EVERY_ATTEMPTS === 0) {
      await messageStore.getState().initialize(accessToken).catch(() => {});
    }
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_INTERVAL_MS));
  }
  return messageStore.getState().connectionState === "ready";
}

/** 不试音订单支付后复用或创建房间，并向已支付的陪玩发送邀请。 */
export async function afterQuickMatchPaidOpenRoom(options: {
  companionUserIds: string[];
  token: string;
  clubId?: string;
}): Promise<void> {
  try {
    const user = useAuthStore.getState().user;
    let room = await voiceRoomApi.getJoinedRoom(options.token);
    if (!resolveVoiceRoomId(room)) {
      room = await voiceRoomApi.createRoom(
        `${user?.nickname || "我"}的语聊房`,
        options.token,
        options.clubId,
      );
    }
    const roomId = resolveVoiceRoomId(room);
    if (!roomId || room?.roomVersion == null) {
      throw new Error("房间信息不完整");
    }
    const version = String(room.roomVersion);
    const link = `https://djpc.jlgkj.top/chat?type=chat-room&id=${encodeURIComponent(roomId)}&v=${encodeURIComponent(version)}`;
    const ids = [...new Set(options.companionUserIds.filter((id) => id && id !== "0"))];
    let failed = ids.length === 0;
    if (ids.length && await waitUntilMessageReady(options.token)) {
      await notifyOrderPaidToCompanions(ids, options.token);
      const results = await Promise.allSettled(ids.map((id) => sendRongText(id, link)));
      failed = results.some((result) => result.status === "rejected");
    } else if (ids.length) {
      failed = true;
    }
    navigateToVoiceRoom({ id: roomId, v: version });
    if (failed) {
      showToast("部分邀请未发送成功，请在语聊房中手动邀请陪玩");
    }
  } catch (error) {
    showToast(`支付成功，但${error instanceof Error ? error.message : "无法创建语聊房"}，请手动进入语聊房邀请陪玩`);
  }
}

/**
 * 支付成功通知陪玩：确保 IM ready 后再 sendText；单条失败静默。
 */
export async function notifyOrderPaidToCompanions(
  companionUserIds: string[],
  accessToken: string | null,
): Promise<void> {
  const ids = companionUserIds.filter((uid) => Boolean(uid) && uid !== "0");
  if (ids.length === 0) return;

  const ready = await waitUntilMessageReady(accessToken);
  if (!ready) return;

  for (const uid of ids) {
    await messageStore
      .getState()
      .sendText(uid, ORDER_PAID_NOTIFY_TEXT)
      .catch(() => {});
  }
}

export type AfterOrderPaidOpenChatOptions = {
  companionUserIds: string[];
  token: string | null;
  chat: {
    id: string;
    title?: string;
    avatar?: string;
    clubId?: string;
    fromProfile?: string;
  };
  /** 默认 push；匹配页用 replace */
  navigate?: "push" | "replace";
  /** 导航前钩子（如语聊房 onClose） */
  beforeNavigate?: () => void;
};

/**
 * 支付成功统一编排：先通知陪玩「我已支付订单~」，再打开聊天页。
 */
export async function afterOrderPaidOpenChat(
  options: AfterOrderPaidOpenChatOptions,
): Promise<void> {
  const {
    companionUserIds,
    token,
    chat,
    navigate = "push",
    beforeNavigate,
  } = options;

  await notifyOrderPaidToCompanions(companionUserIds, token);
  beforeNavigate?.();

  const href = {
    pathname: "/chat/[id]" as const,
    params: {
      id: chat.id,
      ...(chat.title ? { title: chat.title } : {}),
      ...(chat.avatar ? { avatar: chat.avatar } : {}),
      ...(chat.clubId ? { clubId: chat.clubId } : {}),
      ...(chat.fromProfile ? { fromProfile: chat.fromProfile } : {}),
    },
  };
  if (navigate === "replace") {
    router.replace(href);
  } else {
    router.push(href);
  }
}
