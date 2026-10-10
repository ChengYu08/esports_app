import { describe, expect, it } from "vitest";

import { resolveConversationAvatar } from "./message-avatar";

describe("resolveConversationAvatar", () => {
  const defaultAvatar = 42;

  it("uses the local default avatar for the Order Assistant", () => {
    expect(resolveConversationAvatar("订单助手", "https://cdn.example.com/blank.png", defaultAvatar)).toBe(defaultAvatar);
  });

  it("uses the local default avatar when the system ID is supplied", () => {
    expect(resolveConversationAvatar("50000002", undefined, defaultAvatar, "rc_p_50000002")).toBe(defaultAvatar);
  });

  it("keeps a provided avatar for other conversations", () => {
    expect(resolveConversationAvatar("售后客服", "https://cdn.example.com/customer-service.png", defaultAvatar)).toBe("https://cdn.example.com/customer-service.png");
  });
});
