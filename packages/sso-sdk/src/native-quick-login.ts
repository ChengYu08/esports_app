import PzOneClickModule from "../../../modules/pz-one-click";
import type { QuickLoginProvider } from "./types";

type NativeQuickLoginModule = {
  checkLoginAvailableAsync: (tokens: Parameters<QuickLoginProvider["checkLoginAvailable"]>[0], authSDKKey: string) => Promise<boolean>;
  authorizeAsync: (tokens: Parameters<QuickLoginProvider["getLoginToken"]>[0], authSDKKey: string) => ReturnType<QuickLoginProvider["getLoginToken"]>;
  cancelAsync: NonNullable<QuickLoginProvider["cancel"]>;
};

const native = PzOneClickModule as unknown as NativeQuickLoginModule | null;

const unavailableMessage = "一键登录需要使用 development build，Expo Go 暂不支持。";

export function createNativeQuickLoginProvider(authSDKKey: string): QuickLoginProvider {
  return {
    checkLoginAvailable: async (tokens) => {
      if (!native) {
        console.warn(
          "[DEBUG-QUICK-LOGIN] native module is unavailable; using unsupported fallback",
        );
        return false;
      }
      try {
        const available = await native.checkLoginAvailableAsync(tokens, authSDKKey);
        console.info(
          "[DEBUG-QUICK-LOGIN] native availability check returned",
          { available },
        );
        return available;
      } catch (error) {
        console.error("[DEBUG-QUICK-LOGIN] native availability check failed", {
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    getLoginToken: (tokens) => {
      if (!native) return Promise.reject(new Error(unavailableMessage));
      return native.authorizeAsync(tokens, authSDKKey);
    },
    cancel: () => native?.cancelAsync() ?? Promise.resolve(),
  };
}
