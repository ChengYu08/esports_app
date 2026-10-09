import { describe, expect, it } from "vitest";

import { mapRongMessage } from "./chat-message";
import { toManagedMessage } from "./rongcloud-im";

describe("mapRongMessage", () => {
  it("maps a RongCloud image message to a renderable chat image", () => {
    expect(mapRongMessage({
      messageType: 4,
      messageUId: "image-1",
      mediaUrl: "https://cdn.example.com/chat/image-1.jpg",
      sentTime: new Date("2026-10-08T10:30:00").getTime(),
      direction: 0,
    }, { image: 4, send: 0 })).toEqual({
      id: "image-1",
      kind: "image",
      imageUrl: "https://cdn.example.com/chat/image-1.jpg",
      time: "10:30",
      isMine: true,
    });
  });

  it("maps a received RongCloud text message", () => {
    expect(mapRongMessage({
      messageType: 1,
      messageUId: "text-1",
      text: "hello",
      sentTime: new Date("2026-10-08T10:30:00").getTime(),
      direction: 1,
    }, { image: 4, send: 0 })).toEqual({
      id: "text-1",
      kind: "text",
      text: "hello",
      time: "10:30",
      isMine: false,
    });
  });

  it("keeps the SDK ID and timestamp in a confirmed outgoing message", () => {
    expect(toManagedMessage({
      messageUId: "m-1",
      text: "hello",
      direction: 0,
      sentTime: 1000,
    }, { imageType: 4, directionSend: 0, conversationType: 1, timeBefore: 0, localRemote: 2 })).toMatchObject({ id: "m-1", text: "hello", isMine: true, status: "sent", sentAt: 1000 });
  });
});
