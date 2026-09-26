import PzOneClickModule from "../../../modules/pz-one-click";
import type { QuickLoginProvider } from "./types";

const native = PzOneClickModule as unknown as {
  checkLoginAvailableAsync: QuickLoginProvider["checkLoginAvailable"];
  authorizeAsync: QuickLoginProvider["getLoginToken"];
  cancelAsync: NonNullable<QuickLoginProvider["cancel"]>;
};

export function createNativeQuickLoginProvider(): QuickLoginProvider {
  return {
    checkLoginAvailable: (tokens) => native.checkLoginAvailableAsync(tokens),
    getLoginToken: (tokens) => native.authorizeAsync(tokens),
    cancel: () => native.cancelAsync(),
  };
}
