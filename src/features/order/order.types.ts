import type { ImageSource } from "expo-image";

export type OrderScope = "dispatch" | "accept" | "place";
export type OrderFilter = "all" | "inProgress" | "completed" | "cancelled" | "grabbing" | "history";

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
  | "complete"
  | "accept"
  | "reject"
  | "start"
  | "free"
  | "grab";

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
  buyerUserId?: string;
  receiverUserId?: string;
  receiverName?: string;
  receiverAvatar?: ImageSource;
  clubId?: number;
  clubName?: string;
  reviewId?: number;
  reviewExists?: boolean;
  sellerAvatar: ImageSource | number;
  gameIcon?: ImageSource;
  serviceName: string;
  gameName: string;
  billingUnitName?: string;
  requestNo?: string;
  voiceTag?: string;
  sourceLabel?: string;
  unitPrice: string;
  quantity: number;
  totalPrice: string;
  remark?: string;
  createTime?: string;
  paidTime?: string;
  acceptedTime?: string;
  dispatchTime?: string;
  dispatchDeadline?: string;
  serviceStartTime?: string;
  serviceEndTime?: string;
  completedTime?: string;
  actions: readonly OrderAction[];
};

export type OrderQueryStatus = "PROCESSING" | "FINISHED" | "CANCELED";
