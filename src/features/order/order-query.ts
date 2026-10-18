import { queryClient } from "@/core/query/query-client";

export function orderDetailQueryKey(orderId: string | number, scope?: "accept" | "place") {
  return scope ? ["order-detail", String(orderId), scope] as const : ["order-detail", String(orderId)] as const;
}

export async function invalidateOrderQueries(orderId?: string | number) {
  await queryClient.invalidateQueries({
    queryKey: ["orders"],
    refetchType: "none",
  });
  if (orderId !== undefined) {
    await queryClient.invalidateQueries({
      queryKey: orderDetailQueryKey(orderId),
      refetchType: "none",
    });
  }
}
