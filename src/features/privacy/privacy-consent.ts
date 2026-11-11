import { storage } from "@/core/storage/storage";
import ExpoAppToolkit from "../../../modules/expo-app-toolkit";

const PRIVACY_CONSENT_KEY = "esports.privacy.consent.v1";

export async function readPrivacyConsent(): Promise<boolean> {
  try {
    return (await storage.get(PRIVACY_CONSENT_KEY)) === "accepted";
  } catch {
    // A storage failure must fail closed: the user should still see the notice.
    return false;
  }
}

export async function savePrivacyConsent(): Promise<void> {
  await storage.set(PRIVACY_CONSENT_KEY, "accepted");
}

/** 原生 SDK 初始化属于附加动作，失败时不能阻断隐私同意或应用启动。 */
export function notifyNativePrivacyConsentAccepted(): void {
  try {
    ExpoAppToolkit?.markPrivacyConsentAccepted?.();
  } catch {
    // 兼容原生模块未更新或初始化异常的旧构建
  }
}
