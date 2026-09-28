import type { ImageSource } from "expo-image";

export type OrderFilter = "all" | "inProgress" | "completed" | "cancelled";

export type OrderStatus =
  | "pendingPayment"
  | "paid"
  | "completed"
  | "cancelled";

export type OrderActionKey =
  | "cancel"
  | "pay"
  | "afterSales"
  | "review"
  | "reorder";

export type OrderAction = {
  key: OrderActionKey;
  label: string;
  variant: "primary" | "secondary";
};

export type OrderItemModel = {
  id: string;
  status: OrderStatus;
  statusLabel: string;
  sellerName: string;
  sellerAvatar: ImageSource | number;
  serviceName: string;
  gameName: string;
  unitPrice: string;
  quantity: number;
  totalPrice: string;
  actions: readonly OrderAction[];
};
