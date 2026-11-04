import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RongCommand } from "@/features/message/rongcloud-command";
import { parseServerDateTime } from "@/shared/time/server-date";

vi.mock("@/core/logging/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/shared/ui/app-toast", () => ({
  showToast: vi.fn(),
}));

vi.mock("@/shared/ui/action-notice/action-notice-store", () => ({
  actionNotice: {
    push: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("@/shared/ui/action-notice/trade-notice-icon", () => ({
  TRADE_NOTICE_ICON: 1,
}));

vi.mock("@/features/message/cs-invite-claim-state", () => ({
  markCsInviteClaimed: vi.fn(),
  markCsInviteUnclaimed: vi.fn(),
}));

vi.mock("@/features/message/rong-command-dispatch/rong-command-registry", () => ({
  registerRongCommandHandler: vi.fn(() => () => {}),
}));

vi.mock("./use-customer-service-room-flow", () => ({
  claimAndEnterCustomerServiceRoom: vi.fn(),
}));

const setActiveRoom = vi.fn();
let activeRoom: Record<string, unknown> | null = { roomId: "1" };

vi.mock("./voice-room-session", () => ({
  useVoiceRoomSessionStore: {
    getState: () => ({
      activeRoom,
      setActiveRoom,
    }),
  },
}));

const { handleQuickMatchCreated } = await import("./reception-command-handlers");
const { logger } = await import("@/core/logging/logger");

const NOW = parseServerDateTime("2026-11-04 12:00:00");
const PLATFORM = "50000000";

function command(
  data: Record<string, unknown>,
  senderId = PLATFORM,
  sentTime?: number,
): RongCommand {
  return sentTime === undefined
    ? { senderId, name: "QUICK_MATCH_CREATED", data }
    : { senderId, name: "QUICK_MATCH_CREATED", data, sentTime };
}

describe("handleQuickMatchCreated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeRoom = { roomId: "1" };
  });

  it("首次命令且房间在场时写入 quickMatchCreated 场景", () => {
    handleQuickMatchCreated(
      command({ requestNo: "QM10", expireTime: "2026-11-04 12:30:00" }),
      NOW,
    );
    expect(setActiveRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        scene: "quickMatchCreated",
        matchRequestNo: "QM10",
        matchExpireTime: "2026-11-04 12:30:00",
      }),
    );
  });

  it("expireTime 缺失时仍写场景但不带 matchExpireTime", () => {
    handleQuickMatchCreated(command({ requestNo: "QM20" }), NOW);
    expect(setActiveRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        scene: "quickMatchCreated",
        matchRequestNo: "QM20",
      }),
    );
    const room = setActiveRoom.mock.calls[0][0] as Record<string, unknown>;
    expect(room.matchExpireTime).toBeUndefined();
  });

  it("无在场房间时不写场景", () => {
    activeRoom = null;
    handleQuickMatchCreated(
      command({ requestNo: "QM30", expireTime: "2026-11-04 12:30:00" }),
      NOW,
    );
    expect(setActiveRoom).not.toHaveBeenCalled();
  });

  it("expireTime 已过期不写场景并告警", () => {
    handleQuickMatchCreated(
      command({ requestNo: "QM40", expireTime: "2026-11-04 11:00:00" }),
      NOW,
    );
    expect(setActiveRoom).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "quick_match_created.stale_dropped",
      expect.objectContaining({ requestNo: "QM40", stale: false, expired: true }),
    );
  });

  it("sentTime 距今超过 15 分钟的离线重放不写场景", () => {
    handleQuickMatchCreated(
      command(
        { requestNo: "QM50", expireTime: "2026-11-04 12:30:00" },
        PLATFORM,
        NOW - 901_000,
      ),
      NOW,
    );
    expect(setActiveRoom).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "quick_match_created.stale_dropped",
      expect.objectContaining({ requestNo: "QM50", stale: true, expired: false }),
    );
  });

  it("sentTime 距今恰满 15 分钟仍在阈值内，正常写场景", () => {
    handleQuickMatchCreated(
      command(
        { requestNo: "QM60", expireTime: "2026-11-04 12:30:00" },
        PLATFORM,
        NOW - 900_000,
      ),
      NOW,
    );
    expect(setActiveRoom).toHaveBeenCalledTimes(1);
  });

  it("sentTime 缺失时不拦截", () => {
    handleQuickMatchCreated(
      command({ requestNo: "QM70", expireTime: "2026-11-04 12:30:00" }),
      NOW,
    );
    expect(setActiveRoom).toHaveBeenCalledTimes(1);
  });

  it("缺 requestNo 忽略", () => {
    handleQuickMatchCreated(command({}), NOW);
    expect(setActiveRoom).not.toHaveBeenCalled();
  });

  it("非平台发送方忽略", () => {
    handleQuickMatchCreated(
      command({ requestNo: "QM90" }, "60000000"),
      NOW,
    );
    expect(setActiveRoom).not.toHaveBeenCalled();
  });
});
