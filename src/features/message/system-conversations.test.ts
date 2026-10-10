import { describe, expect, it } from "vitest";

import {
  getRongConversationTargetId,
  getSystemConversationTitle,
  isSystemConversationId,
  normalizeSystemConversationId,
} from "./system-conversations";

describe("system conversations", () => {
  it("normalizes the order assistant ID used by the app", () => {
    expect(normalizeSystemConversationId("50000002")).toBe("rc_p_50000002");
    expect(normalizeSystemConversationId("rc_p_50000002")).toBe("rc_p_50000002");
    expect(getRongConversationTargetId("rc_p_50000002")).toBe("50000002");
  });

  it("provides the PC system conversation title", () => {
    expect(isSystemConversationId("50000002")).toBe(true);
    expect(getSystemConversationTitle("rc_p_50000002")).toBe("订单助手");
    expect(getSystemConversationTitle("1001", "用户")).toBe("用户");
  });
});
