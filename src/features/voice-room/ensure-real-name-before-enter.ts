/**
 * 语聊房「房外首次进房」实名门禁：本地 isRealName 先拦，接口未实名兜底弹窗复用。
 */
import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";

import { requiresSelfRealNameVerification } from "@/features/mine/order-real-name";
import { useAppConfirm } from "@/shared/ui/app-confirm";

const SELF_REAL_NAME_PROMPT_MESSAGE = "请先完成实名认证";
const GO_REAL_NAME_CONFIRM_TEXT = "去实名";
const CANCEL_TEXT = "取消";

async function promptGoRealNameVerification(): Promise<void> {
  const confirmed = await useAppConfirm.getState().confirm({
    message: SELF_REAL_NAME_PROMPT_MESSAGE,
    confirmText: GO_REAL_NAME_CONFIRM_TEXT,
    cancelText: CANCEL_TEXT,
  });
  if (confirmed) {
    router.push("/real-name-verification");
  }
}

/** @returns true 已实名可继续；false 已弹窗引导，调用方应中止后续动作 */
export async function ensureRealNameBeforeVoiceRoomEnter(): Promise<boolean> {
  if (useAuthStore.getState().user?.isRealName === 1) {
    return true;
  }
  await promptGoRealNameVerification();
  return false;
}

/**
 * 接口返回「未进行实名认证」时弹同一套「去实名」引导。
 * @returns true 已处理（调用方勿再 Toast）；false 非实名错误
 */
export async function promptSelfRealNameIfNeeded(
  message: string,
): Promise<boolean> {
  if (!requiresSelfRealNameVerification(message)) {
    return false;
  }
  await promptGoRealNameVerification();
  return true;
}
