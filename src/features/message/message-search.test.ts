import { describe, expect, it } from "vitest";

import type { MessageConversation } from "./message-state";
import { filterMessageConversations } from "./message-search";

const conversations: MessageConversation[] = [
  { id: "1001", title: "王者陪玩", preview: "在吗", time: "10:00", unreadCount: 1, updatedAt: 2 },
  { id: "2002", title: "小明", preview: "好的", time: "09:00", unreadCount: 0, updatedAt: 1 },
  { id: "rc_p_50000002", title: "50000002", preview: "订单已更新", time: "08:00", unreadCount: 0, updatedAt: 0 },
];

describe("filterMessageConversations", () => {
  it("matches a conversation by nickname", () => {
    expect(filterMessageConversations(conversations, "陪玩")).toEqual([conversations[0]]);
  });

  it("matches a conversation by user ID case-insensitively", () => {
    expect(filterMessageConversations(conversations, "2002")).toEqual([conversations[1]]);
  });

  it("returns all conversations for an empty or whitespace-only keyword", () => {
    expect(filterMessageConversations(conversations, "  ")).toEqual(conversations);
  });

  it("returns an empty list when there is no match", () => {
    expect(filterMessageConversations(conversations, "不存在")).toEqual([]);
  });

  it("matches the Order Assistant by its system title", () => {
    expect(filterMessageConversations(conversations, "订单助手")).toEqual([conversations[2]]);
  });
});
