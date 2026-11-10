import type { OrderItemModel } from "./order.types";

type MultiCompanionFields = Pick<
  OrderItemModel,
  "multiCompanion" | "multiCompanionCount" | "companions"
>;

/** 一单多陪：开始服务前是否需要先选参与大神（对齐 Web 端判定口径） */
export function needsMultiCompanionSelect(
  order: MultiCompanionFields,
): boolean {
  const needCount = order.multiCompanionCount ?? 1;
  const selectedCount = order.companions?.length ?? 0;
  return (
    order.multiCompanion === true &&
    needCount >= 2 &&
    selectedCount < needCount - 1
  );
}

/** 需选择的参与大神人数（配置总人数 - 1 主单） */
export function multiCompanionNeedSelect(
  order: Pick<OrderItemModel, "multiCompanionCount">,
): number {
  return Math.max(1, (order.multiCompanionCount ?? 1) - 1);
}
