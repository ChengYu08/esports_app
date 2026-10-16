import { describe, expect, it } from "vitest";

import {
  ORDER_ASSISTANT_AVATAR,
  resolveConversationAvatar,
} from "./message-avatar";

describe("resolveConversationAvatar", () => {
  const defaultAvatar = 42;

  it("uses the Order Assistant avatar asset", () => {
    expect(
      resolveConversationAvatar(undefined, defaultAvatar, "rc_p_50000002"),
    ).toBe(ORDER_ASSISTANT_AVATAR);
  });

  it("uses the default avatar for other system conversations", () => {
    expect(
      resolveConversationAvatar(undefined, defaultAvatar, "rc_p_50000000"),
    ).toBe(defaultAvatar);
  });

  it("keeps a provided avatar for other conversations", () => {
    expect(
      resolveConversationAvatar(
        "https://cdn.example.com/customer-service.png",
        defaultAvatar,
      ),
    ).toBe("https://cdn.example.com/customer-service.png");
  });
});
