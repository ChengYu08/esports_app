import type { ImageSource } from "expo-image";

export type OrderFilter = "all" | "inProgress" | "completed" | "cancelled";

export type OrderStatus =
  | "pendingPayment"
  | "paid"
  | "waitingService"
  | "inService"
  | "completed"
  | "cancelled"
  | "refunded";

export type OrderActionKey =
  | "cancel"
  | "pay"
  | "afterSales"
  | "review"
  | "reorder"
  | "complete";

export type OrderAction = {
  key: OrderActionKey;
  label: string;
  variant: "primary" | "secondary";
};

export type OrderItemModel = {
  id: string;
  orderNo?: string;
  status: OrderStatus;
  statusLabel: string;
  sellerName: string;
  sellerAvatar: ImageSource | number;
  serviceName: string;
  gameName: string;
  unitPrice: string;
  quantity: number;
  totalPrice: string;
  createTime?: string;
  paidTime?: string;
  acceptedTime?: string;
  serviceStartTime?: string;
  completedTime?: string;
  actions: readonly OrderAction[];
};

export type OrderQueryStatus = "PROCESSING" | "FINISHED" | "CANCELED";
