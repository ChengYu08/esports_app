import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";

export function requireLogin(): boolean {
  const { accessToken, user } = useAuthStore.getState();
  if (accessToken && user) return true;

  router.push("/login");
  return false;
}

/**
 * 登录页退出/成功后的返回：push 进来的场景退回来源页；
 * 点 Tab、登录态失效等 replace 进来的场景没有可退页面，回首页兜底。
 */
export function backAfterLogin(): void {
  if (router.canDismiss()) {
    router.back();
  } else {
    router.replace("/");
  }
}
