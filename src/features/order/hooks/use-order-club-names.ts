import { useQueries } from "@tanstack/react-query";

import { fetchOrderClub } from "@/features/order/order.api";
import { orderClubQueryKey } from "@/features/order/order-query";

/** 俱乐部名称解析结果：clubId → 名称（未加载完的 id 不在结果里）。 */
export function useOrderClubNames(clubIds: readonly number[]): Record<number, string> {
  const uniqueIds = Array.from(
    new Set(clubIds.filter((id) => Number.isFinite(id) && id > 0)),
  );
  const queries = useQueries({
    queries: uniqueIds.map((clubId) => ({
      queryKey: orderClubQueryKey(clubId),
      queryFn: ({ signal }) => fetchOrderClub(clubId, signal),
      // 俱乐部名基本不变，10 分钟内直接用缓存
      staleTime: 10 * 60_000,
      retry: 1,
    })),
  });
  const names: Record<number, string> = {};
  queries.forEach((query, index) => {
    const club = query.data;
    if (club) {
      names[uniqueIds[index]] = club.name;
    }
  });
  return names;
}
