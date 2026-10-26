import { useAuthStore } from "@esports/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";

import { companionManagementApi as api } from "../api/companion-management.api";

export function useManagementAccount() {
  const token = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id);
  const clubId = useAuthStore((state) => state.user?.clubInfo?.id);
  const isCompanion = useAuthStore((state) => state.isCompanion);
  const context = {
    userId: userId ?? "",
    clubId: clubId ? String(clubId) : "",
  };
  return {
    token: token ?? "",
    context,
    enabled: Boolean(token && userId && clubId && isCompanion),
    queryKey: ["companion-management", userId, clubId] as const,
    unavailable: !token
      ? "请先登录"
      : !clubId
        ? "当前账号未加入俱乐部"
        : !isCompanion
          ? "当前账号没有陪玩管理权限"
          : null,
  };
}

export function useCompanionOverview() {
  const account = useManagementAccount();
  const focused = useIsFocused();
  const enabled = account.enabled && focused;
  const wallet = useQuery({
    queryKey: [...account.queryKey, "wallet"],
    queryFn: ({ signal }) => api.wallet(account.token, signal),
    enabled,
    staleTime: 0,
  });
  const orders = useQuery({
    queryKey: [...account.queryKey, "orders"],
    queryFn: ({ signal }) => api.orderStat(account.token, signal),
    enabled,
    staleTime: 0,
  });
  const games = useQuery({
    queryKey: [...account.queryKey, "games"],
    queryFn: ({ signal }) => api.games(account.context, account.token, signal),
    enabled,
    staleTime: 0,
  });
  return { account, wallet, orders, games };
}

export function useManagedGame(gameId?: string, withServices = false) {
  const account = useManagementAccount();
  const focused = useIsFocused();
  const context = { ...account.context, gameId: gameId ?? "" };
  const enabled = account.enabled && focused && Boolean(gameId);
  const detailKey = [...account.queryKey, "game", gameId] as const;
  const servicesKey = [...account.queryKey, "services", gameId] as const;
  const detail = useQuery({
    queryKey: detailKey,
    queryFn: ({ signal }) => api.gameDetail(context, account.token, signal),
    enabled,
    staleTime: 0,
  });
  const services = useQuery({
    queryKey: servicesKey,
    queryFn: ({ signal }) => api.services(context, account.token, signal),
    enabled: enabled && withServices,
    staleTime: 0,
  });
  const client = useQueryClient();
  const invalidate = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: detailKey }),
      client.invalidateQueries({ queryKey: servicesKey }),
      client.invalidateQueries({ queryKey: ["profile-game-detail"] }),
    ]);
  };
  const assertCurrentAccount = () => {
    const current = useAuthStore.getState();
    if (
      !account.enabled ||
      current.accessToken !== account.token ||
      current.user?.id !== context.userId ||
      String(current.user?.clubInfo?.id) !== context.clubId
    ) {
      throw new Error("登录状态已变化，请重新进入页面");
    }
  };
  return {
    ...account,
    context,
    detail,
    services,
    invalidate,
    assertCurrentAccount,
  };
}
