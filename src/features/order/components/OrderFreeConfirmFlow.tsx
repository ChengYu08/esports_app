import { useState } from "react";
import { Platform } from "react-native";

import { createFreeOrderPreview } from "@/features/order/free-amount";
import { formatOrderTime } from "@/features/order/order-detail-format";
import type { OrderItemModel } from "@/features/order/order.types";
import { OrderCompleteConfirmSheet } from "./OrderCompleteConfirmSheet";
import { OrderFreeConfirmDialog } from "./OrderFreeConfirmDialog";

type Props = {
  order: OrderItemModel;
  companionName: string;
  companionAvatar?: OrderItemModel["receiverAvatar"];
  loading: boolean;
  onClose: () => void;
  onConfirm: (freeHours: number) => void;
};

type Step =
  | { name: "quantity" }
  | { name: "dismissing" | "confirm"; freeHours: number; preview: OrderItemModel };

/** 列表与详情共用两步免单流程：输入个数后核对订单，最终确认才提交免单。 */
export function OrderFreeConfirmFlow({ order, companionName, companionAvatar, loading, onClose, onConfirm }: Props) {
  const [step, setStep] = useState<Step>({ name: "quantity" });

  const handleQuantityConfirm = (freeHours: number) => {
    if (loading) {
      return;
    }
    const preview = createFreeOrderPreview(order, freeHours);
    if (!preview) {
      return;
    }
    // iOS 必须等输入弹窗退出原生展示层后，再打开抽屉，避免连续展示 Modal 失败。
    setStep({ name: Platform.OS === "ios" ? "dismissing" : "confirm", freeHours, preview });
  };

  const handleInputDismiss = () => {
    setStep((current) => current.name === "dismissing" ? { ...current, name: "confirm" } : current);
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleConfirm = () => {
    if (loading || step.name !== "confirm") {
      return;
    }
    onConfirm(step.freeHours);
  };

  return (
    <>
      <OrderFreeConfirmDialog
        visible={step.name === "quantity"}
        order={order}
        loading={loading}
        onClose={handleClose}
        onDismiss={handleInputDismiss}
        onConfirm={handleQuantityConfirm}
      />
      {step.name === "confirm" ? (
        <OrderCompleteConfirmSheet
          visible
          order={step.preview}
          companionName={companionName}
          companionAvatar={companionAvatar}
          serviceTime={formatOrderTime(order.serviceStartTime || order.serviceEndTime || order.createTime)}
          loading={loading}
          onClose={handleClose}
          onConfirm={handleConfirm}
        />
      ) : null}
    </>
  );
}
