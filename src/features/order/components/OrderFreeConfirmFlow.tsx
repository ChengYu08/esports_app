import { formatOrderTime } from "@/features/order/order-detail-format";
import type { OrderItemModel } from "@/features/order/order.types";
import { OrderCompleteConfirmSheet } from "./OrderCompleteConfirmSheet";

type Props = {
  order: OrderItemModel;
  companionName: string;
  companionAvatar?: OrderItemModel["receiverAvatar"];
  loading: boolean;
  onClose: () => void;
  onConfirm: (freeHours: number) => void;
};

/** 列表与详情共用免单流程：直接在确认抽屉内输入免单时长，实时预览后确认提交。 */
export function OrderFreeConfirmFlow({ order, companionName, companionAvatar, loading, onClose, onConfirm }: Props) {
  return (
    <OrderCompleteConfirmSheet
      visible
      freeOrder
      order={order}
      companionName={companionName}
      companionAvatar={companionAvatar}
      serviceTime={formatOrderTime(order.serviceStartTime || order.serviceEndTime || order.createTime)}
      loading={loading}
      onClose={onClose}
      onConfirmFree={onConfirm}
    />
  );
}
