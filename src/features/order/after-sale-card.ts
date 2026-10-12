export type AfterSaleCardPayload = { orderId: number; orderNo?: string; companionUserId?: number; companionNickname?: string; gameName?: string; serviceDesc?: string; unitPrice?: number; quantity?: number; totalPrice?: number; createTime?: string; remark?: string; clubId?: number; csUserId: number };

export type AfterSaleCardRow = { label: string; value: string };

export const AFTER_SALE_CARD_TITLE = "订单服务不满意，申请售后～";

function text(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function formatCardTime(value?: string) {
  return value ? String(value).replace("T", " ").slice(0, 19) : "";
}

export function afterSaleCardRows(payload: Partial<AfterSaleCardPayload>): AfterSaleCardRow[] {
  const rows: AfterSaleCardRow[] = [];
  const push = (label: string, value: unknown) => {
    const formatted = text(value);
    if (formatted) rows.push({ label, value: formatted });
  };

  const companionNickname = text(payload.companionNickname);
  const companionUserId = text(payload.companionUserId);
  if (companionNickname) {
    push("陪玩师", companionUserId ? `${companionNickname}（ID：${companionUserId}）` : companionNickname);
  }
  push("订单号", payload.orderNo);
  push("游戏", payload.gameName);
  const serviceDesc = text(payload.serviceDesc);
  const unitPrice = text(payload.unitPrice);
  if (serviceDesc) push("服务", unitPrice ? `${serviceDesc} ${unitPrice}星钻/小时` : serviceDesc);
  push("数量", payload.quantity ? `${payload.quantity}小时` : "");
  push("总价", payload.totalPrice ? `${payload.totalPrice}星钻` : "");
  push("时间", formatCardTime(payload.createTime));
  push("备注", payload.remark);
  return rows;
}

export function buildAfterSalePayload(order: {
  id: string; orderNo?: string; receiverUserId?: string; sellerName: string; gameName: string; serviceName: string;
  unitPrice: string; quantity: number; totalPrice: string; createTime?: string; remark?: string; clubId?: number;
}, csUserId: number): AfterSaleCardPayload {
  return {
    orderId: Number(order.id),
    orderNo: text(order.orderNo) || undefined,
    companionUserId: order.receiverUserId ? Number(order.receiverUserId) || undefined : undefined,
    companionNickname: text(order.sellerName) || undefined,
    gameName: text(order.gameName) || undefined,
    serviceDesc: text(order.serviceName) || undefined,
    unitPrice: order.unitPrice !== "" ? Number(order.unitPrice) : undefined,
    quantity: order.quantity,
    totalPrice: order.totalPrice !== "" ? Number(order.totalPrice) : undefined,
    createTime: text(order.createTime) || undefined,
    remark: text(order.remark) || undefined,
    clubId: order.clubId,
    csUserId: Number(csUserId),
  };
}
