import { describe, expect, it } from "vitest";

import { getConversationDisplayTitle } from "./message-title";

describe("getConversationDisplayTitle", () => {
  it("uses a non-empty note before the conversation nickname", () => {
    expect(getConversationDisplayTitle("42", "大神昵称", "常用大神")).toBe(
      "常用大神",
    );
  });

  it("falls back to the nickname when the note is blank", () => {
    expect(getConversationDisplayTitle("42", "大神昵称", "  ")).toBe(
      "大神昵称",
    );
  });

  it("keeps system conversation titles", () => {
    expect(getConversationDisplayTitle("rc_p_50000000", "原始名称")).toBe(
      "平台通知",
    );
  });
});
