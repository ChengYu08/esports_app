import { describe, expect, it } from "vitest";

import { mapRongMessage } from "./chat-message";

describe("mapRongMessage", () => {
  it("maps a RongCloud image message to a renderable chat image", () => {
    expect(mapRongMessage({
      messageType: 4,
      messageUId: "image-1",
      mediaUrl: "https://cdn.example.com/chat/image-1.jpg",
      sentTime: new Date("2026-10-08T10:30:00").getTime(),
      direction: 0,
    })).toEqual({
      id: "image-1",
      kind: "image",
      imageUrl: "https://cdn.example.com/chat/image-1.jpg",
      time: "10:30",
      isMine: true,
    });
  });
});
