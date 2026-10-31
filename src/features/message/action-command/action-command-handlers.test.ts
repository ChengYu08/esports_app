import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  actionNotice,
  resetActionNoticeStore,
  useActionNoticeStore,
} from "@/shared/ui/action-notice/action-notice-store";
import type { RongCommand } from "@/features/message/rongcloud-command";

vi.mock("react-native-root-toast", () => ({
  default: {
    show: vi.fn(),
    durations: { SHORT: 2000, LONG: 3500 },
    positions: { CENTER: 0 },
  },
}));

vi.mock("@/shared/ui/action-notice/trade-notice-icon", () => ({
  TRADE_NOTICE_ICON: 1,
}));

vi.mock("@/features/match/grab-quick-match-flow", () => ({
  grabQuickMatchAndEnterAudition: vi.fn(),
}));

vi.mock("@esports/auth", () => ({
  useAuthStore: { getState: () => ({ accessToken: "token" }) },
}));

vi.mock("expo-router", () => ({
  router: { push: vi.fn() },
}));

vi.mock("@/features/order/order.api", () => ({
  acceptOrder: vi.fn(),
}));

vi.mock("@/features/order/order-query", () => ({
  refreshDispatchForRemoteChange: vi.fn(),
}));

vi.mock("@/core/logging/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const {
  handleOrderNotifyPopup,
  handleQuickMatchExpired,
  handleQuickMatchNotice,
  resetActionCommandDedupKeys,
} = await import("./action-command-handlers");
const { refreshDispatchForRemoteChange } = await import("@/features/order/order-query");
const { logger } = await import("@/core/logging/logger");

const NOW = new Date("2026-10-20T12:00:00").getTime();
const PLATFORM = "50000000";

function command(
  name: string,
  data: Record<string, unknown>,
  senderId = PLATFORM,
  sentTime?: number,
): RongCommand {
  return sentTime === undefined
    ? { senderId, name, data }
    : { senderId, name, data, sentTime };
}

describe("handleQuickMatchNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      maxDurationMs: 15_000,
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

  it("expireTime 不可解析时按 15 秒兜底", () => {
    handleQuickMatchNotice(command("QUICK_MATCH_NOTICE", { requestNo: "QM1" }), NOW);
    expect(useActionNoticeStore.getState().items[0]?.expireAt).toBe(NOW + 15_000);
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

  it("合法抢单消息刷新派单中心", () => {
    handleQuickMatchNotice(
      command("QUICK_MATCH_NOTICE", {
        requestNo: "QM1",
        expireTime: "2026-10-20 12:30:00",
      }),
      NOW,
    );
    expect(refreshDispatchForRemoteChange).toHaveBeenCalledTimes(1);
  });

  it("需求已过期仍刷新派单中心（列表可据此移除该需求）", () => {
    handleQuickMatchNotice(
      command("QUICK_MATCH_NOTICE", {
        requestNo: "QM1",
        expireTime: "2026-10-20 11:00:00",
      }),
      NOW,
    );
    expect(refreshDispatchForRemoteChange).toHaveBeenCalledTimes(1);
    expect(useActionNoticeStore.getState().items).toHaveLength(0);
  });

  it("非平台发送方不刷新派单中心", () => {
    handleQuickMatchNotice(
      command("QUICK_MATCH_NOTICE", { requestNo: "QM1" }, "60000000"),
      NOW,
    );
    expect(refreshDispatchForRemoteChange).not.toHaveBeenCalled();
  });

  it("sentTime 距今超过 30 分钟的离线重放通知不弹条，仍刷新派单中心", () => {
    handleQuickMatchNotice(
      command(
        "QUICK_MATCH_NOTICE",
        { requestNo: "QM1", expireTime: "2026-10-20 12:30:00" },
        PLATFORM,
        NOW - 1_801_000,
      ),
      NOW,
    );
    expect(useActionNoticeStore.getState().items).toHaveLength(0);
    expect(refreshDispatchForRemoteChange).toHaveBeenCalledTimes(1);
  });

  it("sentTime 距今恰满 30 分钟仍在阈值内，正常弹条", () => {
    handleQuickMatchNotice(
      command(
        "QUICK_MATCH_NOTICE",
        { requestNo: "QM1", expireTime: "2026-10-20 12:30:00" },
        PLATFORM,
        NOW - 1_800_000,
      ),
      NOW,
    );
    expect(useActionNoticeStore.getState().items).toHaveLength(1);
  });

  it("sentTime 在 30 分钟内正常弹条", () => {
    handleQuickMatchNotice(
      command(
        "QUICK_MATCH_NOTICE",
        { requestNo: "QM1", expireTime: "2026-10-20 12:30:00" },
        PLATFORM,
        NOW - 30_000,
      ),
      NOW,
    );
    expect(useActionNoticeStore.getState().items).toHaveLength(1);
  });

  it("sentTime 缺失不拦截", () => {
    handleQuickMatchNotice(
      command("QUICK_MATCH_NOTICE", {
        requestNo: "QM1",
        expireTime: "2026-10-20 12:30:00",
      }),
      NOW,
    );
    expect(useActionNoticeStore.getState().items).toHaveLength(1);
  });

  it("打印是否过期、是否离线重放、是否缺字段的日志", () => {
    handleQuickMatchNotice(
      command(
        "QUICK_MATCH_NOTICE",
        { requestNo: "QM1", expireTime: "2026-10-20 11:00:00" },
        PLATFORM,
        NOW - 3_601_000,
      ),
      NOW,
    );
    expect(logger.info).toHaveBeenCalledWith(
      "QUICK_MATCH_NOTICE",
      expect.objectContaining({
        requestNo: "QM1",
        expired: true,
        stale: true,
        missingFields: "",
        expireAt: "2026-10-20 11:00:00",
        sentTime: "2026-10-20 10:59:59",
      }),
    );
  });

  it("expireTime 缺失时日志标记 missingFields", () => {
    handleQuickMatchNotice(command("QUICK_MATCH_NOTICE", { requestNo: "QM1" }), NOW);
    expect(logger.info).toHaveBeenCalledWith(
      "QUICK_MATCH_NOTICE",
      expect.objectContaining({
        requestNo: "QM1",
        expired: false,
        stale: false,
        missingFields: "expireTime",
        expireAt: undefined,
        sentTime: undefined,
      }),
    );
  });

  it("缺 requestNo 时告警日志", () => {
    handleQuickMatchNotice(command("QUICK_MATCH_NOTICE", {}), NOW);
    expect(logger.warn).toHaveBeenCalledWith(
      "QUICK_MATCH_NOTICE 缺少 requestNo",
      expect.objectContaining({ senderId: PLATFORM }),
    );
    expect(useActionNoticeStore.getState().items).toHaveLength(0);
  });
});

describe("handleOrderNotifyPopup", () => {
  beforeEach(() => {
    resetActionCommandDedupKeys();
    resetActionNoticeStore();
  });

  const payload = {
    title: "订单支付通知",
    orderId: 123,
    orderNo: "PZ1",
    buyerNickname: "老板B",
    buyerHeadImage: "https://example.com/a.png",
  };

  it("首次命令入队且文案完整", () => {
    handleOrderNotifyPopup(command("ORDER_NOTIFY", payload), NOW);
    const items = useActionNoticeStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "pay:PZ1",
      text: "「老板B」已支付订单，请尽快接单",
      actionText: "接单",
      expireAt: NOW + 15_000,
      maxDurationMs: 15_000,
    });
  });

  it("同 orderNo 二次不弹，dismiss 后可再弹", () => {
    const cmd = command("ORDER_NOTIFY", payload);
    handleOrderNotifyPopup(cmd, NOW);
    handleOrderNotifyPopup(cmd, NOW);
    expect(useActionNoticeStore.getState().items).toHaveLength(1);
    actionNotice.dismiss("pay:PZ1");
    handleOrderNotifyPopup(cmd, NOW);
    expect(useActionNoticeStore.getState().items).toHaveLength(1);
  });

  it("orderId 无效丢弃", () => {
    handleOrderNotifyPopup(command("ORDER_NOTIFY", { ...payload, orderId: 0 }), NOW);
    handleOrderNotifyPopup(command("ORDER_NOTIFY", { ...payload, orderNo: "" }), NOW);
    expect(useActionNoticeStore.getState().items).toHaveLength(0);
  });

  it("非平台发送方忽略", () => {
    handleOrderNotifyPopup(command("ORDER_NOTIFY", payload, "60000000"), NOW);
    expect(useActionNoticeStore.getState().items).toHaveLength(0);
  });

  it("昵称为空时降级文案", () => {
    handleOrderNotifyPopup(
      command("ORDER_NOTIFY", { ...payload, buyerNickname: "" }),
      NOW,
    );
    expect(useActionNoticeStore.getState().items[0]?.text).toBe(
      "「老板」已支付订单，请尽快接单",
    );
  });
});

describe("handleQuickMatchExpired", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetActionCommandDedupKeys();
  });

  it("写终止信号并撤对应抢单通知条，同时刷新派单中心", () => {
    const notifyEnded = vi.fn();
    const dismissQuickMatchBar = vi.fn();
    handleQuickMatchExpired(command("QUICK_MATCH_EXPIRED", { requestNo: "QM1" }), {
      notifyEnded,
      dismissQuickMatchBar,
    });
    expect(notifyEnded).toHaveBeenCalledWith("QM1", "expired");
    expect(dismissQuickMatchBar).toHaveBeenCalledWith("QM1");
    expect(refreshDispatchForRemoteChange).toHaveBeenCalledTimes(1);
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
    expect(refreshDispatchForRemoteChange).not.toHaveBeenCalled();
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
    expect(refreshDispatchForRemoteChange).not.toHaveBeenCalled();
  });
});
