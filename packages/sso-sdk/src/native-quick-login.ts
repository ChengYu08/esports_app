import PzOneClickModule from "../../../modules/pz-one-click";
import type { QuickLoginProvider } from "./types";

type NativeQuickLoginModule = {
  checkLoginAvailableAsync: (tokens: Parameters<QuickLoginProvider["checkLoginAvailable"]>[0], authSDKKey: string) => Promise<boolean>;
  authorizeAsync: (tokens: Parameters<QuickLoginProvider["getLoginToken"]>[0], authSDKKey: string) => ReturnType<QuickLoginProvider["getLoginToken"]>;
  cancelAsync: NonNullable<QuickLoginProvider["cancel"]>;
};

const native = PzOneClickModule as unknown as NativeQuickLoginModule | null;

const unavailableMessage = "一键登录需要使用 development build，Expo Go 暂不支持。";

function cancelledReason(error: unknown): "switch" | "exit" | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  if (code === "USER_SWITCHED") return "switch";
  // 旧原生包只有 USER_CANCELLED 一个码，按 exit 处理（退出登录页）
  if (code === "USER_EXITED" || code === "USER_CANCELLED") return "exit";
  return null;
}

export function createNativeQuickLoginProvider(
  authSDKKey: string,
  options?: { onAuthPageClosed?: () => void },
): QuickLoginProvider {
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
    getLoginToken: async (tokens) => {
      if (!native) throw new Error(unavailableMessage);
      // 阿里云 helper 是单例，重复 getLoginToken 会覆盖上一次注册的监听器。
      // 并发授权时取消回调只送达到最后一个监听器，前面的 promise 会永远挂着。
      // 这里先把原生残留状态清掉（cancel 会结束上一个监听器），保证只有一个授权在飞。
      await Promise.resolve(native.cancelAsync()).catch(() => {});
      try {
        return await native.authorizeAsync(tokens, authSDKKey);
      } catch (error) {
        // 取消不走 reject：授权页已关闭，立刻通知路由撤掉全屏遮罩，
        // 用 cancelled 标记把退出方式作为正常结果带回（并发时无论哪个 promise
        // 收到取消，路由都能正确收尾）。
        const reason = cancelledReason(error);
        if (reason) {
          options?.onAuthPageClosed?.();
          return { cancelled: reason };
        }
        throw error;
      }
    },
    cancel: () => native?.cancelAsync() ?? Promise.resolve(),
  };
}
