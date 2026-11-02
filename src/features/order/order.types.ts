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
  /** 活动需求轻量标识（activityCode 非空时输出「活动」，普通需求不输出） */
  activityTag?: string;
  sourceLabel?: string;
  unitPrice: string;
  quantity: number;
  totalPrice: string;
  /** 订单类型（ACTIVITY=活动单，COMPANION=普通陪玩单等） */
  orderType?: string;
  /** 实付金额（买家视角合计口径，活动订单为折后金额） */
  realPayAmount?: string;
  /** 活动商品 ID（非空表示商品订单；不得用 activityId 反查活动商品） */
  productId?: number;
  /** 活动周期 ID（活动订单输出，普通订单不输出） */
  activityId?: number;
  /** 优惠金额（活动订单输出，普通订单不输出） */
  discountAmount?: number;
  /** 原价口径退款基数（活动订单免单传参用，普通订单不输出） */
  refundBaseAmount?: number;
  /** 已免单的星钻金额，来自订单退款信息 */
  freeAmount?: string;
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
