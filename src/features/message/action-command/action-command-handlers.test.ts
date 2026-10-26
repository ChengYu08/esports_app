import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  actionNotice,
  resetActionNoticeStore,
  useActionNoticeStore,
} from "@/shared/ui/action-notice/action-notice-store";
import { useActionCommandDialog } from "./action-command-store";
import type { RongCommand } from "@/features/message/rongcloud-command";

vi.mock("react-native-root-toast", () => ({
  default: { show: vi.fn(), durations: { SHORT: 2000 } },
}));

vi.mock("@/shared/ui/action-notice/trade-notice-icon", () => ({
  TRADE_NOTICE_ICON: 1,
}));

vi.mock("@/features/match/grab-quick-match-flow", () => ({
  grabQuickMatchAndEnterAudition: vi.fn(),
}));

const {
  handleOrderNotifyPopup,
  handleQuickMatchExpired,
  handleQuickMatchNotice,
  releaseOrderPayKey,
  resetActionCommandDedupKeys,
} = await import("./action-command-handlers");

const NOW = new Date("2026-10-20T12:00:00").getTime();
const PLATFORM = "50000000";

function command(name: string, data: Record<string, unknown>, senderId = PLATFORM): RongCommand {
  return { senderId, name, data };
}

function resetStore() {
  useActionCommandDialog.setState({ current: null, queue: [] });
}

describe("handleQuickMatchNotice", () => {
  beforeEach(() => {
    resetActionCommandDedupKeys();
    resetActionNoticeStore();
  });

  it("首次命令入队且文案仅含游戏名", () => {
    handleQuickMatchNotice(
      command("QUICK_MATCH_NOTICE", {
        requestNo: "QM1",
        buyerNickname: "老板A",
        gameName: "王者荣耀",
        modeName: "上分",
        levelName: "钻石",
        serviceName: "陪玩",
        expireTime: "2026-10-20 12:30:00",
      }),
      NOW,
    );
    const items = useActionNoticeStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "qm:QM1",
      text: "「老板A」发布了王者荣耀需求",
      expireAt: new Date("2026-10-20T12:30:00").getTime(),
      maxDurationMs: 30_000,
    });
  });

  it("同 requestNo 二次不弹", () => {
    const cmd = command("QUICK_MATCH_NOTICE", {
      requestNo: "QM1",
      expireTime: "2026-10-20 12:30:00",
    });
    handleQuickMatchNotice(cmd, NOW);
    handleQuickMatchNotice(cmd, NOW);
    expect(useActionNoticeStore.getState().items).toHaveLength(1);
  });

  it("expireTime 已过期不弹", () => {
    handleQuickMatchNotice(
      command("QUICK_MATCH_NOTICE", {
        requestNo: "QM1",
        expireTime: "2026-10-20 11:00:00",
      }),
      NOW,
    );
    expect(useActionNoticeStore.getState().items).toHaveLength(0);
  });

  it("expireTime 不可解析时按 30 秒兜底", () => {
    handleQuickMatchNotice(command("QUICK_MATCH_NOTICE", { requestNo: "QM1" }), NOW);
    expect(useActionNoticeStore.getState().items[0]?.expireAt).toBe(NOW + 30_000);
  });

  it("服务字段全空时降级文案", () => {
    handleQuickMatchNotice(
      command("QUICK_MATCH_NOTICE", { requestNo: "QM1", expireTime: "2026-10-20 12:30:00" }),
      NOW,
    );
    expect(useActionNoticeStore.getState().items[0]?.text).toBe("「老板」发布了快速匹配需求");
  });

  it("非平台发送方忽略", () => {
    handleQuickMatchNotice(
      command("QUICK_MATCH_NOTICE", { requestNo: "QM1" }, "60000000"),
      NOW,
    );
    expect(useActionNoticeStore.getState().items).toHaveLength(0);
  });

  it("其它命令名忽略", () => {
    handleQuickMatchNotice(command("ROOM_KICKED", { requestNo: "QM1" }), NOW);
    expect(useActionNoticeStore.getState().items).toHaveLength(0);
  });

  it("释放去重键后同 requestNo 可再次弹", () => {
    const cmd = command("QUICK_MATCH_NOTICE", {
      requestNo: "QM1",
      expireTime: "2026-10-20 12:30:00",
    });
    handleQuickMatchNotice(cmd, NOW);
    actionNotice.dismiss("qm:QM1");
    handleQuickMatchNotice(cmd, NOW);
    expect(useActionNoticeStore.getState().items).toHaveLength(1);
  });
});

describe("handleOrderNotifyPopup", () => {
  const show = vi.fn();

  beforeEach(() => {
    show.mockClear();
    resetActionCommandDedupKeys();
  });

  const payload = {
    title: "订单支付通知",
    orderId: 123,
    orderNo: "PZ1",
    buyerNickname: "老板B",
    buyerHeadImage: "https://example.com/a.png",
  };

  it("首次命令触发 show 且字段完整", () => {
    handleOrderNotifyPopup(command("ORDER_NOTIFY", payload), show);
    expect(show).toHaveBeenCalledWith({
      key: "pay:PZ1",
      orderId: "123",
      orderNo: "PZ1",
      title: "订单支付通知",
      buyerNickname: "老板B",
      buyerHeadImage: "https://example.com/a.png",
    });
  });

  it("同 orderNo 二次不弹，释放后可再弹", () => {
    const cmd = command("ORDER_NOTIFY", payload);
    handleOrderNotifyPopup(cmd, show);
    handleOrderNotifyPopup(cmd, show);
    expect(show).toHaveBeenCalledTimes(1);
    releaseOrderPayKey("PZ1");
    handleOrderNotifyPopup(cmd, show);
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("orderId 无效丢弃", () => {
    handleOrderNotifyPopup(command("ORDER_NOTIFY", { ...payload, orderId: 0 }), show);
    handleOrderNotifyPopup(command("ORDER_NOTIFY", { ...payload, orderNo: "" }), show);
    expect(show).not.toHaveBeenCalled();
  });

  it("非平台发送方忽略", () => {
    handleOrderNotifyPopup(command("ORDER_NOTIFY", payload, "60000000"), show);
    expect(show).not.toHaveBeenCalled();
  });
});

describe("handleQuickMatchExpired", () => {
  beforeEach(() => {
    resetStore();
    resetActionCommandDedupKeys();
  });

  it("写终止信号并撤对应抢单通知条", () => {
    const notifyEnded = vi.fn();
    const dismissQuickMatchBar = vi.fn();
    handleQuickMatchExpired(command("QUICK_MATCH_EXPIRED", { requestNo: "QM1" }), {
      notifyEnded,
      dismissQuickMatchBar,
    });
    expect(notifyEnded).toHaveBeenCalledWith("QM1", "expired");
    expect(dismissQuickMatchBar).toHaveBeenCalledWith("QM1");
  });

  it("QUICK_MATCH_CANCELLED 映射为 cancelled", () => {
    const notifyEnded = vi.fn();
    const dismissQuickMatchBar = vi.fn();
    handleQuickMatchExpired(command("QUICK_MATCH_CANCELLED", { requestNo: "QM1" }), {
      notifyEnded,
      dismissQuickMatchBar,
    });
    expect(notifyEnded).toHaveBeenCalledWith("QM1", "cancelled");
    expect(dismissQuickMatchBar).toHaveBeenCalledWith("QM1");
  });

  it("缺 requestNo 或非平台发送方忽略", () => {
    const notifyEnded = vi.fn();
    const dismissQuickMatchBar = vi.fn();
    handleQuickMatchExpired(command("QUICK_MATCH_EXPIRED", {}), {
      notifyEnded,
      dismissQuickMatchBar,
    });
    handleQuickMatchExpired(
      command("QUICK_MATCH_EXPIRED", { requestNo: "QM1" }, "60000000"),
      {
        notifyEnded,
        dismissQuickMatchBar,
      },
    );
    expect(notifyEnded).not.toHaveBeenCalled();
    expect(dismissQuickMatchBar).not.toHaveBeenCalled();
  });

  it("其它命令名忽略", () => {
    const notifyEnded = vi.fn();
    const dismissQuickMatchBar = vi.fn();
    handleQuickMatchExpired(command("QUICK_MATCH_NOTICE", { requestNo: "QM1" }), {
      notifyEnded,
      dismissQuickMatchBar,
    });
    expect(notifyEnded).not.toHaveBeenCalled();
    expect(dismissQuickMatchBar).not.toHaveBeenCalled();
  });
});

describe("useActionCommandDialog 队列（仅 orderPay）", () => {
  function pay(key: string) {
    return { key, orderId: key, orderNo: key, title: "t", buyerNickname: "b" };
  }

  beforeEach(() => {
    resetStore();
    resetActionCommandDedupKeys();
  });

  it("current 为空直接展示，occupied 时入队", () => {
    const { show, dismiss } = useActionCommandDialog.getState();
    show(pay("pay:1"));
    show(pay("pay:2"));
    expect(useActionCommandDialog.getState().current?.key).toBe("pay:1");
    expect(useActionCommandDialog.getState().queue.map((item) => item.key)).toEqual(["pay:2"]);

    dismiss();
    expect(useActionCommandDialog.getState().current?.key).toBe("pay:2");
    expect(useActionCommandDialog.getState().queue).toHaveLength(0);
  });

  it("队满保留最新、丢弃最旧", () => {
    const { show } = useActionCommandDialog.getState();
    show(pay("pay:1"));
    show(pay("pay:2"));
    show(pay("pay:3"));
    show(pay("pay:4"));
    expect(useActionCommandDialog.getState().queue.map((item) => item.key)).toEqual([
      "pay:2",
      "pay:3",
      "pay:4",
    ]);
  });
});
