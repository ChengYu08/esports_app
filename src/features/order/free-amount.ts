import type { OrderItemModel } from "@/features/order/order.types";

/** 免单时长步长，与 Web 端保持一致 */
export const FREE_STEP = 0.1;

/** 星钻金额保留最多两位小数 */
export function roundStar(n: number) {
  return Number(n.toFixed(2));
}

/** 已免单的金额从实付款中扣除，确认完成时显示剩余应收星钻 */
export function computeOrderPayableStars(
  order: Pick<OrderItemModel, "totalPrice" | "freeAmount">,
) {
  const total = Number(order.totalPrice);
  const free = Number(order.freeAmount ?? 0);
  if (!Number.isFinite(total) || !Number.isFinite(free)) {
    return 0;
  }
  return roundStar(Math.max(0, total - Math.max(0, free)));
}

export function formatStar(n: number) {
  return roundStar(n)
    .toFixed(2)
    .replace(/\.?0+$/, "");
}

export function formatHours(n: number) {
  return String(Number(n.toFixed(1)));
}

/** 解析时长输入，null 表示未填写/不合法 */
export function parseHoursLive(raw: string) {
  const text = raw.trim();
  if (!text || text === "." || !/^\d*(\.\d?)?$/.test(text)) {
    return null;
  }
  const n = Number(text);
  if (!Number.isFinite(n)) {
    return null;
  }
  return n;
}

/** 只允许数字与一个小数点，小数点后最多 1 位 */
export function sanitizeHoursText(raw: string) {
  const t = raw.replace(/[^\d.]/g, "");
  const firstDot = t.indexOf(".");
  if (firstDot === -1) {
    return t;
  }
  const intPart = t.slice(0, firstDot);
  const decAll = t.slice(firstDot + 1).replace(/\./g, "");
  return `${intPart}.${decAll.slice(0, 1)}`;
}

type FreePriceSource = Pick<
  OrderItemModel,
  "quantity" | "unitPrice" | "totalPrice"
>;

/** 钻石/时长：优先单价，缺省用总价除以订单时长 */
export function computeFreeUnitPrice(order: FreePriceSource) {
  const orderHours = Math.max(FREE_STEP, Number(order.quantity) || 1);
  const unit = Number(order.unitPrice);
  if (Number.isFinite(unit) && unit > 0) {
    return unit;
  }
  const total = Number(order.totalPrice);
  if (Number.isFinite(total) && total > 0) {
    return total / orderHours;
  }
  return 0;
}

/** 免单时长换算星钻，结果只保留最多两位小数；无效返回 null */
export function computeFreeStarAmount(
  order: FreePriceSource,
  freeHours: number,
) {
  if (!(freeHours > 0)) {
    return null;
  }
  const raw = roundStar(freeHours * computeFreeUnitPrice(order));
  if (raw <= 0) {
    return null;
  }
  return raw;
}

/** 订单保留下单数量，已免数量按退款星钻与原单价折算，单独展示。 */
export function formatOrderFreeSummary(
  order: FreePriceSource &
    Pick<OrderItemModel, "freeAmount" | "billingUnitName">,
) {
  const freeAmount = Number(order.freeAmount);
  if (!Number.isFinite(freeAmount) || freeAmount <= 0) {
    return undefined;
  }
  const unitPrice = computeFreeUnitPrice(order);
  const amountText = `${formatStar(freeAmount)}星钻`;
  if (unitPrice <= 0) {
    return amountText;
  }
  return `${formatHours(freeAmount / unitPrice)}${order.billingUnitName || "小时"}（${amountText}）`;
}

/** 只生成待确认的免单预览，最终确认前不修改原订单或提交接口。 */
export function createFreeOrderPreview(
  order: OrderItemModel,
  freeHours: number,
): OrderItemModel | null {
  const starAmount = computeFreeStarAmount(order, freeHours);
  if (
    starAmount == null ||
    freeHours > order.quantity ||
    starAmount > computeOrderPayableStars(order)
  ) {
    return null;
  }
  return {
    ...order,
    freeAmount: formatStar(Number(order.freeAmount ?? 0) + starAmount),
  };
}
