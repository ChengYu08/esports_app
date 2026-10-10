import { describe, expect, it } from "vitest";

import { markMessageFailed, mergeConversations, mergeMessages, prependHistory, replacePendingMessage, type ManagedMessage } from "./message-state";

const pending: ManagedMessage = {
  id: "local-1",
  clientId: "local-1",
  kind: "text",
  text: "hi",
  time: "10:00",
  isMine: true,
  status: "pending",
  sentAt: 10,
};

describe("message state helpers", () => {
  it("moves an updated peer to the top without duplicating it", () => {
    const updated = { id: "1", title: "Peer", preview: "latest", time: "10:00", unreadCount: 4, updatedAt: 4 };
    expect(mergeConversations([
      { id: "2", title: "Old", preview: "old", time: "09:00", unreadCount: 0, updatedAt: 2 },
      { ...updated, preview: "previous", updatedAt: 3 },
    ], updated).map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("keeps pinned peers ahead of newer unpinned peers and preserves local settings", () => {
    const pinned = { id: "1", title: "Peer", preview: "latest", time: "10:00", unreadCount: 0, updatedAt: 1, isPinned: true, note: "熟客" };
    expect(mergeConversations([
      { id: "1", title: "Peer", preview: "old", time: "09:00", unreadCount: 0, updatedAt: 1, isPinned: true, note: "熟客" },
      { id: "2", title: "Newer", preview: "new", time: "10:01", unreadCount: 0, updatedAt: 10 },
    ], { id: "1", title: "Peer", preview: "latest", time: "10:00", unreadCount: 0, updatedAt: 1 })).toEqual([
      pinned,
      { id: "2", title: "Newer", preview: "new", time: "10:01", unreadCount: 0, updatedAt: 10 },
    ]);
  });

  it("replaces a pending message and prepends unique chronological history", () => {
    const sent = { ...pending, id: "server-1", status: "sent" as const };
    expect(replacePendingMessage([pending], "local-1", sent)).toEqual([sent]);
    expect(prependHistory([sent], [sent, { ...sent, id: "old", sentAt: 1 }]).map((item) => item.id)).toEqual(["old", "server-1"]);
    expect(markMessageFailed([pending], "local-1")[0].status).toBe("failed");
  });

  it("deduplicates message IDs and keeps chronological order", () => {
    const older = { ...pending, id: "old", sentAt: 1 };
    expect(mergeMessages([older], { ...older, text: "updated" })).toEqual([{ ...older, text: "updated" }]);
  });
});
