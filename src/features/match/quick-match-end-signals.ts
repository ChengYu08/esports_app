import { create } from "zustand";

export type QuickMatchEndSignalReason = "expired" | "cancelled";

type QuickMatchEndSignalsState = {
  signals: Record<string, QuickMatchEndSignalReason>;
  notifyEnded: (requestNo: string, reason: QuickMatchEndSignalReason) => void;
  consume: (requestNo: string) => QuickMatchEndSignalReason | undefined;
};

/**
 * 快速匹配超时/取消信令（QUICK_MATCH_EXPIRED / QUICK_MATCH_CANCELLED）的进程内信号表。
 * 命令到达时写入，消费方（匹配中会话 / 语聊房 audition 场景）按自己的 requestNo 消费。
 */
export const useQuickMatchEndSignals = create<QuickMatchEndSignalsState>((set, get) => ({
  signals: {},
  notifyEnded: (requestNo, reason) =>
    set((state) => ({ signals: { ...state.signals, [requestNo]: reason } })),
  consume: (requestNo) => {
    const reason = get().signals[requestNo];
    if (reason === undefined) return undefined;
    set((state) => {
      const next = { ...state.signals };
      delete next[requestNo];
      return { signals: next };
    });
    return reason;
  },
}));
