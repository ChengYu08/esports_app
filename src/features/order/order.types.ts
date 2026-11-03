import type { ImageSource } from "expo-image";

export type OrderScope = "dispatch" | "accept" | "place";
export type OrderFilter = "all" | "inProgress" | "completed" | "cancelled" | "grabbing" | "history";

export type OrderStatus =
  | "pendingPayment"
  | "paid"
  | "waitingService"
  | "inService"
  | "completed"
  | "partiallyRefunded"
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

export type MultiCompanionCandidateModel = {
  userId: string;
  nickname?: string;
  headImage?: string;
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
  gameModeName?: string;
  gameLevelName?: string;
  orderServiceName?: string;
  billingUnitName?: string;
  requestNo?: string;
  voiceTag?: string;
  sourceLabel?: string;
  unitPrice: string;
  quantity: number;
  totalPrice: string;
  /** 已免单的钻石金额，来自订单退款信息 */
  freeAmount?: string;
  remark?: string;
  createTime?: string;
  /** 待支付订单的支付截止时间，优先使用服务端值 */
  payDeadline?: string;
  paidTime?: string;
  acceptedTime?: string;
  dispatchTime?: string;
  dispatchDeadline?: string;
  serviceStartTime?: string;
  serviceEndTime?: string;
  completedTime?: string;
  /** 是否一单多陪 */
  multiCompanion?: boolean;
  /** 一单多陪总人数（含主单，2~4） */
  multiCompanionCount?: number;
  /** 参与陪玩（不含主单）；未选满时开始服务需先弹选人 */
  companions?: MultiCompanionCandidateModel[];
  actions: readonly OrderAction[];
};

export type OrderQueryStatus = "PROCESSING" | "FINISHED" | "CANCELED";
