import PzOneClickModule from "../../../modules/pz-one-click";
import type { QuickLoginProvider } from "./types";

type NativeQuickLoginModule = {
  checkLoginAvailableAsync: QuickLoginProvider["checkLoginAvailable"];
  authorizeAsync: QuickLoginProvider["getLoginToken"];
  cancelAsync: NonNullable<QuickLoginProvider["cancel"]>;
};

const native = PzOneClickModule as unknown as NativeQuickLoginModule | null;

const unavailableMessage = "一键登录需要使用 development build，Expo Go 暂不支持。";

export function createNativeQuickLoginProvider(): QuickLoginProvider {
  return {
    checkLoginAvailable: async (tokens) => {
      if (!native) {
        console.warn(
          "[DEBUG-QUICK-LOGIN] native module is unavailable; using unsupported fallback",
        );
        return false;
      }
      try {
        const available = await native.checkLoginAvailableAsync(tokens);
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
      return native.authorizeAsync(tokens);
    },
    cancel: () => native?.cancelAsync() ?? Promise.resolve(),
  };
}
