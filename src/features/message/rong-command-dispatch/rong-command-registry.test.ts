import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RongCommand } from "@/features/message/rongcloud-command";

vi.mock("@/core/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const {
  clearRongCommandHandlers,
  dispatchRongCommand,
  registerRongCommandHandler,
} = await import("./rong-command-registry");

function command(name = "TEST"): RongCommand {
  return { senderId: "1", name, data: {} };
}

describe("rong-command-registry", () => {
  beforeEach(() => {
    clearRongCommandHandlers();
  });

  it("requireAuth 默认跳过无 token 的 handler", () => {
    const handle = vi.fn();
    registerRongCommandHandler({ id: "authed", handle });
    dispatchRongCommand(command(), { accessToken: null, userId: "" });
    expect(handle).not.toHaveBeenCalled();
  });

  it("requireAuth:false 在无 token 时仍调用", () => {
    const handle = vi.fn();
    registerRongCommandHandler({ id: "kick", requireAuth: false, handle });
    dispatchRongCommand(command("ROOM_KICKED"), { accessToken: null, userId: "" });
    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle.mock.calls[0][1]).toEqual({ userId: "" });
  });

  it("有 token 时调用 requireAuth handler 并传入 userId", () => {
    const handle = vi.fn();
    registerRongCommandHandler({ id: "authed", handle });
    dispatchRongCommand(command(), { accessToken: "t", userId: "42" });
    expect(handle).toHaveBeenCalledWith(command(), { userId: "42" });
  });

  it("unregister 后不再调用", () => {
    const handle = vi.fn();
    const unregister = registerRongCommandHandler({ id: "once", handle });
    unregister();
    dispatchRongCommand(command(), { accessToken: "t", userId: "1" });
    expect(handle).not.toHaveBeenCalled();
  });
});
