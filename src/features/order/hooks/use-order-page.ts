import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuthStore } from "@esports/auth";
import { fetchOrderPage } from "../order.api";
import { fetchDispatchPage } from "../dispatch.api";
import type { OrderFilter, OrderScope } from "../order.types";

export function useOrderPage(scope: OrderScope, filter: OrderFilter) {
  const token = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id);
  const gender = useAuthStore((state) => state.user?.gender ?? 2);
  return useInfiniteQuery({
    queryKey: ["orders", scope, filter, userId],
    initialPageParam: 1,
    queryFn: async ({ signal, pageParam }) => {
      if (scope === "dispatch") {
        return fetchDispatchPage(filter === "history" ? "history" : "grabbing", token as string, gender, pageParam, 10, signal);
      }
      return fetchOrderPage(filter, token as string, userId as string, scope, pageParam, 20, signal);
    },
    getNextPageParam: (lastPage, allPages) => lastPage.hasMore ? allPages.length + 1 : undefined,
    enabled: Boolean(token && (scope === "dispatch" || userId)),
  });
}
