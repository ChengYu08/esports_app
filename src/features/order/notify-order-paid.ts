import { router } from "expo-router";

import { messageStore } from "@/features/message/message-store";

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
