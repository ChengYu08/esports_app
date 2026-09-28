import type { OrderFilter, OrderItemModel } from "./order.types";

export function filterOrders(
  items: readonly OrderItemModel[],
  filter: OrderFilter,
) {
  if (filter === "all") return items;

  if (filter === "inProgress") {
    return items.filter(
      ({ status }) => status === "pendingPayment" || status === "paid",
    );
  }

  return items.filter(({ status }) => status === filter);
}
