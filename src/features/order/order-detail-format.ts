import type { OrderItemModel } from "@/features/order/order.types";

/** 订单时间字段展示格式：2026-10-29 19:30:00 */
export function formatOrderTime(value?: string) {
  return value ? value.replace("T", " ").slice(0, 19) : "-";
}

/** 服务时间段展示：开始 - 结束，缺失一侧时只展示另一侧 */
export function formatServiceTime(startTime?: string, endTime?: string) {
  const start = formatOrderTime(startTime);
  const end = formatOrderTime(endTime);
  if (start === "-") return end;
  if (end === "-") return start;
  return `${start} - ${end}`;
}

/** 抢单倒计时展示：X分XX秒 */
export function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}分${String(remainder).padStart(2, "0")}秒`;
}

/** 取头像资源里的 uri 字符串，供路由参数传递 */
export function imageSourceUri(source: OrderItemModel["sellerAvatar"]) {
  if (typeof source === "string") return source;
  if (typeof source !== "object" || source === null || !("uri" in source)) {
    return "";
  }
  return typeof source.uri === "string" ? source.uri : "";
}
