import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";

export function requireLogin(): boolean {
  const { accessToken, user } = useAuthStore.getState();
  if (accessToken && user) return true;

  router.push("/login");
  return false;
}
