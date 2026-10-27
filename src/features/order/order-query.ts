import { queryClient } from "@/core/query/query-client";
import type { InfiniteData } from "@tanstack/react-query";
import { fetchOrderDetail, mapOrder } from "./order.api";
import type { OrderItemModel } from "./order.types";

export function orderDetailQueryKey(orderId: string | number, scope?: "accept" | "place") {
  return scope ? ["order-detail", String(orderId), scope] as const : ["order-detail", String(orderId)] as const;
}

export async function invalidateOrderQueries(orderId?: string | number) {
  await queryClient.invalidateQueries({
    queryKey: ["orders"],
    refetchType: "active",
  });
  if (orderId !== undefined) {
    await queryClient.invalidateQueries({
      queryKey: orderDetailQueryKey(orderId),
      refetchType: "none",
    });
  }
}

/** 将启动成功的状态与详情数据对齐，即使分页接口返回延迟也需保证一致。 */
export async function refreshStartedOrder(orderId: string, token: string, userId: string) {
  await invalidateOrderQueries(orderId);
  const raw = await fetchOrderDetail(orderId, token);
  const keys = queryClient.getQueryCache().findAll({ queryKey: ["orders"] });
  for (const { queryKey } of keys) {
    const [, scope, filter, accountId] = queryKey;
    if (accountId !== userId || (scope !== "accept" && scope !== "place")) continue;
    if (filter !== "all" && filter !== "inProgress") continue;
    const updated = mapOrder(raw, 0, scope);
    queryClient.setQueryData<InfiniteData<{ items: OrderItemModel[]; hasMore: boolean }>>(
      queryKey,
      (data) => data ? {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((item) => item.id === orderId ? updated : item),
        })),
      } : data,
    );
  }
}
