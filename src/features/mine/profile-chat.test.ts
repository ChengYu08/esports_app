import { describe, expect, it } from "vitest";

import { createProfileChatParams } from "./profile-chat";

describe("createProfileChatParams", () => {
  it("uses the profile user as the chat target", () => {
    expect(createProfileChatParams({ userId: 42, nickname: "Peer", headImage: "avatar" })).toEqual({ id: "42", title: "Peer", avatar: "avatar" });
  });
});
