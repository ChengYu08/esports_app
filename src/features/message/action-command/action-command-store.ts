import { create } from "zustand";

/** ORDER_NOTIFY（RC:CmdMsg 支付催单信令）弹窗数据；不自动关，仅手动关闭/接单成功后消失 */
export type OrderPayDialogData = {
  key: string;
  orderId: string;
  orderNo: string;
  title: string;
  buyerNickname: string;
  buyerHeadImage?: string;
};

const QUEUE_LIMIT = 3;

type ActionCommandState = {
  current: OrderPayDialogData | null;
  queue: OrderPayDialogData[];
  show: (data: OrderPayDialogData) => void;
  dismiss: () => void;
};

export const useActionCommandDialog = create<ActionCommandState>((set, get) => ({
  current: null,
  queue: [],
  show: (data) => {
    const { current, queue } = get();
    if (!current) {
      set({ current: data });
      return;
    }
    const next = [...queue, data].slice(-QUEUE_LIMIT);
    set({ queue: next });
  },
  dismiss: () => {
    const { queue } = get();
    const [next, ...rest] = queue;
    set({ current: next ?? null, queue: rest });
  },
}));
