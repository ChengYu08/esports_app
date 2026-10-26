import { beforeEach, describe, expect, it, vi } from "vitest";

import { useActionCommandDialog } from "./action-command-store";
import {
  handleOrderNotifyPopup,
  handleQuickMatchExpired,
  handleQuickMatchNotice,
  releaseOrderPayKey,
  releaseQuickMatchNoticeKey,
  resetActionCommandDedupKeys,
} from "./action-command-handlers";
import type { RongCommand } from "@/features/message/rongcloud-command";
import type { QuickMatchNoticeBarInvite } from "@/features/match/quick-match-invite-bar-store";

const NOW = new Date("2026-10-20T12:00:00").getTime();
const PLATFORM = "50000000";

function command(name: string, data: Record<string, unknown>, senderId = PLATFORM): RongCommand {
  return { senderId, name, data };
}

function resetStore() {
  useActionCommandDialog.setState({ current: null, queue: [] });
}

describe("handleQuickMatchNotice", () => {
  const show = vi.fn<(invite: QuickMatchNoticeBarInvite) => void>();

  beforeEach(() => {
    show.mockClear();
    resetActionCommandDedupKeys();
  });

  it("首次命令触发 show 且文案包含游戏·模式·等级·服务", () => {
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
      show,
      NOW,
    );
    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith({
      key: "qm:QM1",
      requestNo: "QM1",
      text: "「老板A」发布 王者荣耀·上分·钻石·陪玩 需求",
      expireAt: new Date("2026-10-20T12:30:00").getTime(),
    });
  });

  it("同 requestNo 二次不弹", () => {
    const cmd = command("QUICK_MATCH_NOTICE", {
      requestNo: "QM1",
      expireTime: "2026-10-20 12:30:00",
    });
    handleQuickMatchNotice(cmd, show, NOW);
    handleQuickMatchNotice(cmd, show, NOW);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("expireTime 已过期不弹", () => {
    handleQuickMatchNotice(
      command("QUICK_MATCH_NOTICE", {
        requestNo: "QM1",
        expireTime: "2026-10-20 11:00:00",
      }),
      show,
      NOW,
    );
    expect(show).not.toHaveBeenCalled();
  });

  it("expireTime 不可解析时按 30 秒兜底", () => {
    handleQuickMatchNotice(
      command("QUICK_MATCH_NOTICE", { requestNo: "QM1" }),
      show,
      NOW,
    );
    expect(show.mock.calls[0][0].expireAt).toBe(NOW + 30_000);
  });

  it("服务字段全空时降级文案", () => {
    handleQuickMatchNotice(
      command("QUICK_MATCH_NOTICE", { requestNo: "QM1", expireTime: "2026-10-20 12:30:00" }),
      show,
      NOW,
    );
    expect(show.mock.calls[0][0].text).toBe("「老板」发布了快速匹配需求");
  });

  it("非平台发送方忽略", () => {
    handleQuickMatchNotice(
      command("QUICK_MATCH_NOTICE", { requestNo: "QM1" }, "60000000"),
      show,
      NOW,
    );
    expect(show).not.toHaveBeenCalled();
  });

  it("其它命令名忽略", () => {
    handleQuickMatchNotice(command("ROOM_KICKED", { requestNo: "QM1" }), show, NOW);
    expect(show).not.toHaveBeenCalled();
  });

  it("释放去重键后同 requestNo 可再次弹", () => {
    const cmd = command("QUICK_MATCH_NOTICE", {
      requestNo: "QM1",
      expireTime: "2026-10-20 12:30:00",
    });
    handleQuickMatchNotice(cmd, show, NOW);
    releaseQuickMatchNoticeKey("QM1");
    handleQuickMatchNotice(cmd, show, NOW);
    expect(show).toHaveBeenCalledTimes(2);
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
