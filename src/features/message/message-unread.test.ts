import { describe, expect, it } from "vitest";

import { isVisibleMessageConversation, sumVisibleUnreadCount } from "./message-unread";

describe("visible message unread count", () => {
  it("excludes self and blacklisted conversations while retaining system unread", () => {
    const conversations = [
      { id: "42", unreadCount: 2 },
      { id: "7", unreadCount: 3 },
      { id: "rc_p_50000002", unreadCount: 1 },
    ];

    expect(sumVisibleUnreadCount(conversations, "42", ["7"])).toBe(1);
    expect(isVisibleMessageConversation(conversations[0], "42", [])).toBe(false);
    expect(isVisibleMessageConversation(conversations[2], "42", [])).toBe(true);
  });
});
