import type { OrderAction, OrderActionKey } from "./order.types";

export type OrderDetailActionKey = Extract<OrderActionKey, "cancel" | "afterSales">;

export function getOrderDetailAction(
  actions: readonly Pick<OrderAction, "key">[],
): OrderDetailActionKey | null {
  if (actions.some((action) => action.key === "afterSales")) {
    return "afterSales";
  }
  if (actions.some((action) => action.key === "cancel")) {
    return "cancel";
  }
  return null;
}
