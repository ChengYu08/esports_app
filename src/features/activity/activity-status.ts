/** 秒杀活动状态机：按服务端按钮状态 + 服务端校准后的时间窗口 + 库存推导展示态。 */
export type ComputedActivityStatus = "NOT_STARTED" | "ACTIVE" | "SOLD_OUT" | "DISABLED";

export type ComputedActivityResult = {
  status: ComputedActivityStatus;
  disabledReason?: string;
};

export type ActivityStatusInput = {
  startTime: string;
  endTime: string;
  remainingStock: number;
  buttonStatus: string;
  disabledReason?: string;
};

/**
 * 状态优先级：DISABLED > 时间窗口（NOT_STARTED） > 库存（SOLD_OUT） > ACTIVE。
 * - 时间判定用 `nowMs + offsetMs`（offset = serverTime - Date.now() 校准）。
 * - now === startTime 算已开始；now === endTime 算未结束。
 * - ENDED 按 API 文档 PC 约定并入 NOT_STARTED 展示，不读 buttonEnabled。
 */
export function computeActivityStatus(
  detail: ActivityStatusInput,
  nowMs: number,
  offsetMs: number,
): ComputedActivityResult {
  if (detail.buttonStatus === "DISABLED") {
    return { status: "DISABLED", disabledReason: detail.disabledReason || "活动暂不可参与" };
  }

  const serverNowMs = nowMs + offsetMs;
  const startMs = Date.parse(detail.startTime);
  const endMs = Date.parse(detail.endTime);
  if ((Number.isFinite(startMs) && serverNowMs < startMs) || (Number.isFinite(endMs) && serverNowMs > endMs)) {
    return { status: "NOT_STARTED" };
  }

  if (detail.remainingStock <= 0) {
    return { status: "SOLD_OUT" };
  }

  return { status: "ACTIVE" };
}
