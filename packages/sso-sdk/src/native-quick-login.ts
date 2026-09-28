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
    checkLoginAvailable: (tokens) => native?.checkLoginAvailableAsync(tokens) ?? Promise.resolve(false),
    getLoginToken: (tokens) => native?.authorizeAsync(tokens) ?? Promise.reject(new Error(unavailableMessage)),
    cancel: () => native?.cancelAsync() ?? Promise.resolve(),
  };
}
