import type { OrderFilter, OrderItemModel } from "./order.types";

export function filterOrders(
  items: readonly OrderItemModel[],
  filter: OrderFilter,
) {
  if (filter === "all") {
    return items;
  }

  if (filter === "inProgress") {
    return items.filter(
      ({ status }) =>
        status === "pendingPayment" ||
        status === "paid" ||
        status === "waitingService" ||
        status === "inService",
    );
  }

  if (filter === "cancelled") {
    return items.filter(({ status }) => status === "cancelled" || status === "refunded");
  }

  if (filter === "completed") {
    return items.filter(({ status }) => status === "completed" || status === "partiallyRefunded");
  }

  return [];
}
