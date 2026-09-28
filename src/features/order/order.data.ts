import type { OrderItemModel } from "./order.types";

const sellerAvatar = require("../../../assets/order/order-seller-avatar.svg");

const sharedOrder = {
  sellerName: "成都-吴彦祖",
  sellerAvatar,
  serviceName: "服务模式-服务等级",
  gameName: "三角洲端游",
  unitPrice: "1000",
  quantity: 2,
  totalPrice: "2000",
} as const;

export const ORDER_ITEMS = [
  {
    ...sharedOrder,
    id: "pending-payment",
    status: "pendingPayment",
    statusLabel: "待支付",
    actions: [
      { key: "cancel", label: "取消订单", variant: "secondary" },
      { key: "pay", label: "去支付 09:28", variant: "primary" },
    ],
  },
  {
    ...sharedOrder,
    id: "paid",
    status: "paid",
    statusLabel: "已支付",
    actions: [{ key: "cancel", label: "取消订单", variant: "secondary" }],
  },
  {
    ...sharedOrder,
    id: "completed",
    status: "completed",
    statusLabel: "已完成",
    actions: [
      { key: "afterSales", label: "售后", variant: "secondary" },
      { key: "review", label: "评价", variant: "secondary" },
      { key: "reorder", label: "再来一单", variant: "secondary" },
    ],
  },
] satisfies readonly OrderItemModel[];
