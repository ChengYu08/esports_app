import { describe, expect, it } from "vitest";

import { createProfileChatParams } from "./profile-chat";

describe("createProfileChatParams", () => {
  it("uses the profile user as the chat target", () => {
    expect(createProfileChatParams({ userId: 42, nickname: "Peer", headImage: "avatar" })).toEqual({ id: "42", title: "Peer", avatar: "avatar" });
  });

  it("carries the profile club so chat can open the same public homepage", () => {
    expect(createProfileChatParams({ userId: 42, clubId: 7 })).toEqual({ id: "42", title: "用户聊天", avatar: "", clubId: "7" });
  });
});
