import { describe, expect, it, vi } from "vitest";

import { clientAuthApi } from "@/features/auth/client-auth.api";
import type {
    ManagedMessage,
    MessageConversation,
    MessageHistoryPage,
} from "./message-state";
import { createMessageStore, type MessageAdapter } from "./message-store";
import { useInAppNotification } from "./notification-hub";

vi.mock("@/core/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/features/auth/client-auth.api", () => ({
  clientAuthApi: { getUserOnlineStatus: vi.fn(async () => ({})) },
}));
vi.mock("@/core/storage/storage", () => ({
  storage: { get: vi.fn(async () => null) },
}));
vi.mock("@/features/mine/api/blacklist.api", () => ({
  addBlacklistedUser: vi.fn(),
  removeBlacklistedUser: vi.fn(),
}));
vi.mock("./rongcloud-im", () => ({
  isRongCloudAvailable: vi.fn(),
  initializeRongCloud: vi.fn(),
  isRongCloudConnected: vi.fn(() => true),
  getRongConversations: vi.fn(),
  getRongMessages: vi.fn(),
  sendRongText: vi.fn(),
  sendRongImage: vi.fn(),
  downloadRongImageMessage: vi.fn(),
  sendRongAfterSaleCard: vi.fn(),
  markRongConversationRead: vi.fn(),
  setRongConversationPinned: vi.fn(),
  subscribeRongConnectionStatus: vi.fn(),
  subscribeRongConversationSync: vi.fn(),
  subscribeRongConversationReadSync: vi.fn(),
  subscribeRongMessages: vi.fn(),
  subscribeRongMessageEvents: vi.fn(),
  disconnectRongCloud: vi.fn(),
}));

const conversation: MessageConversation = {
  id: "42",
  title: "Peer",
  preview: "",
  time: "",
  unreadCount: 0,
  updatedAt: 1,
};
const sentMessage: ManagedMessage = {
  id: "server-1",
  kind: "text",
  text: "hello",
  time: "10:00",
  isMine: true,
  status: "sent",
  sentAt: 10,
};

function makeAdapter(overrides: Partial<MessageAdapter> = {}) {
  const adapter: MessageAdapter = {
    available: () => true,
    initialize: vi.fn(async () => true),
    isConnected: () => true,
    getConversations: vi.fn(async () => []),
    getMessages: vi.fn(
      async (): Promise<MessageHistoryPage> => ({
        messages: [],
        nextCursor: null,
        hasMore: false,
      }),
    ),
    sendText: vi.fn(async () => sentMessage),
    sendImage: vi.fn(async () => sentMessage),
    markRead: vi.fn(async () => true),
    subscribeConversations: vi.fn(() => () => undefined),
    subscribeMessages: vi.fn(() => () => undefined),
    disconnect: vi.fn(async () => undefined),
    ...overrides,
  };
  return adapter;
}

describe("message store", () => {
  it("keeps customer service identity through history refresh and incoming replies", async () => {
    let receiveMessage:
      | Parameters<MessageAdapter["subscribeMessages"]>[0]
      | undefined;
    const adapter = makeAdapter({
      getConversations: vi.fn(async () => [conversation]),
      subscribeMessages: (listener) => {
        receiveMessage = listener;
        return () => undefined;
      },
    });
    const store = createMessageStore(adapter);
    await store.getState().initialize("token");
    await store.getState().openConversation({
      id: "42",
      title: "【官方客服】小盼",
      isCustomerService: true,
    });
    await store.getState().refreshConversations("token");
    receiveMessage?.("42", { ...sentMessage, isMine: false }, conversation);
    expect(store.getState().conversations[0]).toMatchObject({
      id: "42",
      title: "【官方客服】小盼",
      isCustomerService: true,
    });
    await store.getState().reset();
    expect(store.getState().conversations).toEqual([]);
  });

  it("keeps IM ready and receives live messages when history synchronization fails", async () => {
    let receiveMessage:
      | Parameters<MessageAdapter["subscribeMessages"]>[0]
      | undefined;
    const adapter = makeAdapter({
      getConversations: vi
        .fn()
        .mockRejectedValueOnce(new Error("历史消息同步暂不可用"))
        .mockResolvedValue([conversation]),
      subscribeMessages: (listener) => {
        receiveMessage = listener;
        return () => undefined;
      },
    });
    const store = createMessageStore(adapter);
    await store.getState().initialize("token");
    expect(store.getState().connectionState).toBe("ready");
    expect(store.getState().conversationError).toBe("历史消息同步暂不可用");
    receiveMessage?.("42", { ...sentMessage, isMine: false }, conversation);
    expect(store.getState().conversations).toEqual([
      expect.objectContaining({ id: "42" }),
    ]);
    await store.getState().refreshConversations("token");
    expect(store.getState().conversationError).toBeNull();
    expect(adapter.initialize).toHaveBeenCalledTimes(1);
    await store.getState().reset();
  });

  it("receives messages delivered while the initial conversation snapshot is loading", async () => {
    let receiveMessage:
      | Parameters<MessageAdapter["subscribeMessages"]>[0]
      | undefined;
    let completeSnapshot!: (value: MessageConversation[]) => void;
    const adapter = makeAdapter({
      getConversations: vi.fn(
        () =>
          new Promise<MessageConversation[]>((resolve) => {
            completeSnapshot = resolve;
          }),
      ),
      subscribeMessages: vi.fn((listener) => {
        receiveMessage = listener;
        return () => undefined;
      }),
    });
    const store = createMessageStore(adapter);
    const initializing = store.getState().initialize("token");
    await vi.waitFor(() => expect(completeSnapshot).toBeDefined());
    receiveMessage?.(
      "42",
      { ...sentMessage, isMine: false },
      { ...conversation, preview: "hello" },
    );
    completeSnapshot([]);
    await initializing;
    expect(store.getState().conversations).toEqual([
      expect.objectContaining({ id: "42", preview: "hello", unreadCount: 1 }),
    ]);
    await store.getState().reset();
  });

  it("refreshes the list when SDK conversation synchronization completes", async () => {
    let synchronized: (() => void) | undefined;
    const adapter = makeAdapter({
      getConversations: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValue([conversation]),
      subscribeConversationSync: (listener) => {
        synchronized = listener;
        return () => undefined;
      },
    });
    const store = createMessageStore(adapter);
    await store.getState().initialize("token");
    expect(store.getState().conversations).toEqual([]);
    synchronized?.();
    await vi.waitFor(() =>
      expect(store.getState().conversations).toEqual([
        expect.objectContaining(conversation),
      ]),
    );
    await store.getState().reset();
  });

  it("rechecks the snapshot if offline synchronization finishes during initialization", async () => {
    let synchronized: (() => void) | undefined;
    let completeSnapshot!: (value: MessageConversation[]) => void;
    const store = createMessageStore(
      makeAdapter({
        getConversations: vi
          .fn()
          .mockImplementationOnce(
            () =>
              new Promise((resolve) => {
                completeSnapshot = resolve;
              }),
          )
          .mockResolvedValue([conversation]),
        subscribeConversationSync: (listener) => {
          synchronized = listener;
          return () => undefined;
        },
      }),
    );
    const initializing = store.getState().initialize("token");
    await vi.waitFor(() => expect(completeSnapshot).toBeDefined());
    synchronized?.();
    completeSnapshot([]);
    await initializing;
    expect(store.getState().conversations).toEqual([
      expect.objectContaining(conversation),
    ]);
    await store.getState().reset();
  });

  it("re-reads the snapshot once when the ready list is empty (retryIfEmpty)", async () => {
    // 场景：初始化读快照为空（补偿消息尚未落库），retryIfEmpty 延迟重读后拿到会话
    const adapter = makeAdapter({
      getConversations: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValue([conversation]),
    });
    const store = createMessageStore(adapter);
    await store.getState().initialize("token");
    expect(store.getState().conversations).toEqual([]);
    await store.getState().retryIfEmpty("token");
    expect(store.getState().conversations).toEqual([
      expect.objectContaining({ id: "42" }),
    ]);
  });

  it("resolveImagePreview returns the preview uri without re-pointing the chat bubble at the local original", async () => {
    // 场景：预览大图时下载原图到本地，但气泡仍展示远端缩略源；
    // 覆写气泡 URL 会让返回聊天后多张原图同时重新解码，造成列表滚动卡顿
    let receiveMessage:
      | Parameters<MessageAdapter["subscribeMessages"]>[0]
      | undefined;
    const imageMessage: ManagedMessage = {
      id: "img-1",
      kind: "image",
      imageUrl: "https://ronghub.com/original.jpg",
      time: "10:01",
      isMine: false,
      status: "sent",
      sentAt: 11,
    };
    const adapter = makeAdapter({
      getConversations: vi.fn(async () => [conversation]),
      subscribeMessages: (listener) => {
        receiveMessage = listener;
        return () => undefined;
      },
      downloadImage: vi.fn(async () => "file:///cache/original.jpg"),
    });
    const store = createMessageStore(adapter);
    await store.getState().initialize("token");
    await store.getState().openConversation({ id: "42", title: "Peer" });
    receiveMessage?.("42", imageMessage, conversation);
    const previewUri = await store.getState().resolveImagePreview(imageMessage);
    expect(previewUri).toBe("file:///cache/original.jpg");
    expect(store.getState().messagesByPeerId["42"]?.[0]).toMatchObject({
      imageUrl: "https://ronghub.com/original.jpg",
    });
    await store.getState().reset();
  });

  it("does not re-read when the list already has conversations", async () => {
    const adapter = makeAdapter({
      getConversations: vi.fn().mockResolvedValue([conversation]),
    });
    const store = createMessageStore(adapter);
    await store.getState().initialize("token");
    const callsBefore = (adapter.getConversations as ReturnType<typeof vi.fn>)
      .mock.calls.length;
    await store.getState().retryIfEmpty("token");
    expect(
      (adapter.getConversations as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(callsBefore);
  });

  it("does not re-read twice even if the retry also finds an empty list", async () => {
    const adapter = makeAdapter({
      getConversations: vi.fn().mockResolvedValue([]),
    });
    const store = createMessageStore(adapter);
    await store.getState().initialize("token");
    await store.getState().retryIfEmpty("token");
    const callsAfterFirst = (
      adapter.getConversations as ReturnType<typeof vi.fn>
    ).mock.calls.length;
    await store.getState().retryIfEmpty("token");
    expect(
      (adapter.getConversations as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(callsAfterFirst);
  });

  it("does not re-read when the connection is not ready", async () => {
    const adapter = makeAdapter({
      available: () => false,
      getConversations: vi.fn().mockResolvedValue([conversation]),
    });
    const store = createMessageStore(adapter);
    await store.getState().initialize("token");
    expect(store.getState().connectionState).toBe("unavailable");
    await store.getState().retryIfEmpty("token");
    // unavailable 分支的 initialize 提前返回，getConversations 从未被调用过
    expect(adapter.getConversations).not.toHaveBeenCalled();
  });

  it("keeps incoming live messages when the delayed retry finishes afterwards", async () => {
    // 冲突场景：retryIfEmpty 重读期间用户收到实时消息——重读结果不得把实时消息会话冲掉
    let receiveMessage:
      | Parameters<MessageAdapter["subscribeMessages"]>[0]
      | undefined;
    let completeSnapshot!: (value: MessageConversation[]) => void;
    const adapter = makeAdapter({
      getConversations: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockImplementationOnce(
          () =>
            new Promise<MessageConversation[]>((resolve) => {
              completeSnapshot = resolve;
            }),
        ),
      subscribeMessages: (listener) => {
        receiveMessage = listener;
        return () => undefined;
      },
    });
    const store = createMessageStore(adapter);
    await store.getState().initialize("token");
    const retry = store.getState().retryIfEmpty("token");
    receiveMessage?.(
      "42",
      { ...sentMessage, isMine: false },
      { ...conversation, preview: "hello" },
    );
    completeSnapshot([]);
    await retry;
    const list = store.getState().conversations;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: "42", preview: "hello" });
    await store.getState().reset();
  });

  it("claims the one-shot retry gate before awaiting (concurrent calls)", async () => {
    let completeSnapshot!: (value: MessageConversation[]) => void;
    const adapter = makeAdapter({
      getConversations: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockImplementationOnce(
          () =>
            new Promise<MessageConversation[]>((resolve) => {
              completeSnapshot = resolve;
            }),
        ),
    });
    const store = createMessageStore(adapter);
    await store.getState().initialize("token");
    const first = store.getState().retryIfEmpty("token");
    const second = store.getState().retryIfEmpty("token");
    completeSnapshot([]);
    await Promise.all([first, second]);
    // 初始化 1 次 + 重试 1 次；并发的第二次不得再读
    expect(adapter.getConversations).toHaveBeenCalledTimes(2);
    await store.getState().reset();
  });

  it("rejects a retry from the old session during asynchronous reset", async () => {
    let finishDisconnect!: () => void;
    const adapter = makeAdapter({
      getConversations: vi.fn().mockResolvedValue([]),
      disconnect: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishDisconnect = resolve;
          }),
      ),
    });
    const store = createMessageStore(adapter);
    await store.getState().initialize("token");
    const resetting = store.getState().reset();
    await store.getState().retryIfEmpty("token");
    expect(adapter.getConversations).toHaveBeenCalledTimes(1);
    finishDisconnect();
    await resetting;
  });

  it("rechecks again if offline sync completes during the final initialization sync", async () => {
    let synchronized: (() => void) | undefined;
    let completeFirst!: (value: MessageConversation[]) => void;
    let completeSecond!: (value: MessageConversation[]) => void;
    const adapter = makeAdapter({
      getConversations: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<MessageConversation[]>((resolve) => {
              completeFirst = resolve;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise<MessageConversation[]>((resolve) => {
              completeSecond = resolve;
            }),
        )
        .mockResolvedValue([conversation]),
      subscribeConversationSync: (listener) => {
        synchronized = listener;
        return () => undefined;
      },
    });
    const store = createMessageStore(adapter);
    const initializing = store.getState().initialize("token");
    await vi.waitFor(() => expect(completeFirst).toBeDefined());
    synchronized?.();
    completeFirst([]);
    await vi.waitFor(() => expect(completeSecond).toBeDefined());
    // 第二次（pending）同步执行中再次完成——原窗口会丢重读
    synchronized?.();
    completeSecond([]);
    await initializing;
    expect(store.getState().conversations).toEqual([
      expect.objectContaining(conversation),
    ]);
    await store.getState().reset();
  });

  it("does not create a local message while IM is unavailable", async () => {
    const store = createMessageStore(makeAdapter({ available: () => false }));
    await store.getState().initialize("token");
    await store.getState().sendText("42", "hello");
    expect(store.getState().messagesByPeerId["42"]).toBeUndefined();
    expect(store.getState().lastError).toBe("当前版本暂不支持即时消息");
  });

  it("replaces pending text after the adapter confirms it", async () => {
    const store = createMessageStore(makeAdapter());
    await store.getState().initialize("token");
    await store.getState().sendText("42", "hello");
    expect(store.getState().messagesByPeerId["42"]).toEqual([sentMessage]);
  });

  it("keeps failed sends retryable", async () => {
    const adapter = makeAdapter({
      sendText: vi
        .fn()
        .mockRejectedValueOnce(new Error("network"))
        .mockResolvedValueOnce(sentMessage),
    });
    const store = createMessageStore(adapter);
    await store.getState().initialize("token");
    await store.getState().sendText("42", "hello");
    const failed = store.getState().messagesByPeerId["42"][0];
    expect(failed.status).toBe("failed");
    await store.getState().retryMessage("42", failed.clientId || "");
    expect(store.getState().messagesByPeerId["42"]).toEqual([sentMessage]);
  });

  it("increments unread for inactive incoming messages and clears it for active peers", async () => {
    let receiveConversation: ((value: MessageConversation) => void) | undefined;
    let receiveMessage:
      | ((
          peerId: string,
          message: ManagedMessage,
          value: MessageConversation,
        ) => void)
      | undefined;
    const store = createMessageStore(
      makeAdapter({
        subscribeConversations: vi.fn((callback) => {
          receiveConversation = callback;
          return () => undefined;
        }),
        subscribeMessages: vi.fn((callback) => {
          receiveMessage = callback;
          return () => undefined;
        }),
      }),
    );
    await store.getState().initialize("token");
    receiveConversation?.(conversation);
    receiveMessage?.(
      "42",
      { ...sentMessage, isMine: false },
      { ...conversation, preview: "hello", updatedAt: 10 },
    );
    expect(store.getState().conversations[0].unreadCount).toBe(1);
    expect(store.getState().conversations[0].isOnline).toBe(true);
    await store.getState().openConversation({ id: "42", title: "Peer" });
    expect(store.getState().conversations[0].unreadCount).toBe(0);
    await store.getState().reset();
  });

  it("keeps local pin and note state when the active conversation receives a message", async () => {
    let receiveMessage:
      | Parameters<MessageAdapter["subscribeMessages"]>[0]
      | undefined;
    const store = createMessageStore(
      makeAdapter({
        getConversations: vi.fn(async () => [conversation]),
        subscribeMessages: vi.fn((listener) => {
          receiveMessage = listener;
          return () => undefined;
        }),
      }),
    );
    await store.getState().initialize("token");
    await store.getState().setConversationPinned("42", true);
    store.getState().setConversationNote("42", "常用大神");
    await store.getState().openConversation({ id: "42", title: "Peer" });
    receiveMessage?.("42", { ...sentMessage, isMine: false }, conversation);
    expect(store.getState().conversations[0]).toMatchObject({
      isPinned: true,
      note: "常用大神",
      unreadCount: 0,
    });
    await store.getState().reset();
  });

  it("counts unread while the active conversation is in the background", async () => {
    let receiveMessage:
      | ((
          peerId: string,
          message: ManagedMessage,
          value: MessageConversation,
        ) => void)
      | undefined;
    const store = createMessageStore(
      makeAdapter({
        subscribeMessages: vi.fn((callback) => {
          receiveMessage = callback;
          return () => undefined;
        }),
      }),
    );
    await store.getState().initialize("token");
    await store.getState().openConversation({ id: "42", title: "Peer" });
    store.getState().setChatForeground(false);
    receiveMessage?.(
      "42",
      { ...sentMessage, isMine: false },
      { ...conversation, preview: "hello", updatedAt: 10 },
    );
    expect(store.getState().conversations[0].unreadCount).toBe(1);
    store.getState().setChatForeground(true);
    receiveMessage?.(
      "42",
      { ...sentMessage, isMine: false, id: "server-2" },
      { ...conversation, preview: "again", updatedAt: 20 },
    );
    expect(store.getState().conversations[0].unreadCount).toBe(0);
    await store.getState().reset();
  });

  it("keeps locally accumulated unread when the remote snapshot is smaller", async () => {
    const store = createMessageStore(
      makeAdapter({
        getConversations: vi.fn(async () => [
          { ...conversation, unreadCount: 2 },
        ]),
      }),
    );
    await store.getState().initialize("token");
    await store.getState().refreshConversations("token");
    expect(store.getState().conversations[0].unreadCount).toBe(2);
    await store.getState().clearAllUnread();
    await store.getState().refreshConversations("token");
    expect(store.getState().conversations[0].unreadCount).toBe(2);
    await store.getState().reset();
  });

  it("does not count own messages synced from other devices as unread", async () => {
    let receiveMessage:
      | Parameters<MessageAdapter["subscribeMessages"]>[0]
      | undefined;
    const store = createMessageStore(
      makeAdapter({
        subscribeMessages: vi.fn((callback) => {
          receiveMessage = callback;
          return () => undefined;
        }),
      }),
    );
    await store.getState().initialize("token");
    // 换机后由离线补偿补回来的自己发出的消息，不产生未读，预览照常更新
    receiveMessage?.("42", sentMessage, {
      ...conversation,
      preview: "hello",
      updatedAt: 10,
    });
    expect(store.getState().conversations[0]).toMatchObject({
      id: "42",
      preview: "hello",
      unreadCount: 0,
    });
    receiveMessage?.(
      "42",
      { ...sentMessage, isMine: false },
      { ...conversation, preview: "world", updatedAt: 11 },
    );
    expect(store.getState().conversations[0].unreadCount).toBe(1);
    await store.getState().reset();
  });

  it("does not re-count replayed read messages as unread after reinstall", async () => {
    let receiveMessage:
      | Parameters<MessageAdapter["subscribeMessages"]>[0]
      | undefined;
    const historySentAt = Date.now() - 60_000;
    // 重装后融云会话快照只把真正未读的那条算进来（服务端保存了已读态），
    // 本地不能因为补偿重放了几条历史消息就把它重新累加成未读。
    const store = createMessageStore(
      makeAdapter({
        getConversations: vi
          .fn()
          .mockResolvedValueOnce([conversation])
          .mockResolvedValue([
            {
              ...conversation,
              unreadCount: 1,
              updatedAt: historySentAt + 2_000,
            },
          ]),
        subscribeMessages: vi.fn((listener) => {
          receiveMessage = listener;
          return () => undefined;
        }),
      }),
    );
    await store.getState().initialize("token");
    receiveMessage?.(
      "42",
      {
        ...sentMessage,
        id: "history-1",
        isMine: false,
        sentAt: historySentAt,
        receivedOffline: true,
      },
      { ...conversation, preview: "old", updatedAt: historySentAt },
    );
    receiveMessage?.(
      "42",
      {
        ...sentMessage,
        id: "history-2",
        isMine: false,
        sentAt: historySentAt + 1_000,
        receivedOffline: true,
      },
      { ...conversation, preview: "old-2", updatedAt: historySentAt + 1_000 },
    );
    expect(store.getState().conversations[0].unreadCount).toBe(0);
    await store.getState().refreshConversations("token");
    expect(store.getState().conversations[0].unreadCount).toBe(1);
    await store.getState().reset();
  });

  it("counts an offline message that arrives after the session is ready", async () => {
    let receiveMessage:
      | Parameters<MessageAdapter["subscribeMessages"]>[0]
      | undefined;
    const store = createMessageStore(
      makeAdapter({
        getConversations: vi.fn(async () => [conversation]),
        subscribeMessages: vi.fn((listener) => {
          receiveMessage = listener;
          return () => undefined;
        }),
      }),
    );
    await store.getState().initialize("token");
    receiveMessage?.(
      "42",
      {
        ...sentMessage,
        id: "late-1",
        isMine: false,
        sentAt: Date.now(),
        receivedOffline: true,
      },
      { ...conversation, preview: "late", updatedAt: Date.now() },
    );
    expect(store.getState().conversations[0].unreadCount).toBe(1);
    await store.getState().reset();
  });

  it("counts compensated replayed messages for the hidden diagnostic counter", async () => {
    let receiveMessage:
      | Parameters<MessageAdapter["subscribeMessages"]>[0]
      | undefined;
    const historySentAt = Date.now() - 60_000;
    const store = createMessageStore(
      makeAdapter({
        getConversations: vi.fn(async () => [conversation]),
        subscribeMessages: vi.fn((listener) => {
          receiveMessage = listener;
          return () => undefined;
        }),
      }),
    );
    await store.getState().initialize("token");
    expect(store.getState().compensatedCount).toBe(0);
    // 补偿重放的历史消息：计入诊断计数
    receiveMessage?.(
      "42",
      {
        ...sentMessage,
        id: "replay-1",
        isMine: false,
        sentAt: historySentAt,
        receivedOffline: true,
      },
      conversation,
    );
    receiveMessage?.(
      "42",
      {
        ...sentMessage,
        id: "replay-2",
        isMine: false,
        sentAt: historySentAt + 1_000,
        receivedOffline: true,
      },
      conversation,
    );
    expect(store.getState().compensatedCount).toBe(2);
    // 实时新消息与就绪后迟到的 offline 消息：不属于补偿，不计数
    receiveMessage?.(
      "42",
      { ...sentMessage, id: "live-1", isMine: false, sentAt: Date.now() },
      conversation,
    );
    expect(store.getState().compensatedCount).toBe(2);
    // 登出重置后归零
    await store.getState().reset();
    expect(store.getState().compensatedCount).toBe(0);
  });

  it("clears unread when another device reports the conversation as read", async () => {
    let receiveMessage:
      | Parameters<MessageAdapter["subscribeMessages"]>[0]
      | undefined;
    let reportRead: ((peerId: string, timestamp: number) => void) | undefined;
    const store = createMessageStore(
      makeAdapter({
        subscribeMessages: vi.fn((callback) => {
          receiveMessage = callback;
          return () => undefined;
        }),
        subscribeReadSync: vi.fn((listener) => {
          reportRead = listener;
          return () => undefined;
        }),
      }),
    );
    await store.getState().initialize("token");
    receiveMessage?.("42", { ...sentMessage, isMine: false }, conversation);
    expect(store.getState().conversations[0].unreadCount).toBe(1);
    // 其他设备已读后服务端推送的同步通知，本机未读数随之清零
    reportRead?.("42", 30);
    expect(store.getState().conversations[0].unreadCount).toBe(0);
    await store.getState().reset();
  });

  it("does not show in-app banner for compensated messages sent before this session", async () => {
    let receiveMessage:
      | Parameters<MessageAdapter["subscribeMessages"]>[0]
      | undefined;
    const adapter = makeAdapter({
      subscribeMessages: (listener) => {
        receiveMessage = listener;
        return () => undefined;
      },
    });
    const store = createMessageStore(adapter);
    useInAppNotification.getState().dismiss();
    await store.getState().initialize("token");
    // 模拟重装后离线补偿：sentAt 早于本次登录就绪时间，且带补偿标记
    receiveMessage?.(
      "42",
      { ...sentMessage, isMine: false, sentAt: 10, receivedOffline: true },
      conversation,
    );
    expect(useInAppNotification.getState().notification).toBeNull();
    // 补偿的历史消息不再计入未读，红点由融云会话快照提供
    expect(store.getState().conversations[0]).toMatchObject({
      id: "42",
      unreadCount: 0,
    });
    await store.getState().reset();
  });

  it("shows in-app banner for live messages arriving after session ready", async () => {
    let receiveMessage:
      | Parameters<MessageAdapter["subscribeMessages"]>[0]
      | undefined;
    const adapter = makeAdapter({
      subscribeMessages: (listener) => {
        receiveMessage = listener;
        return () => undefined;
      },
    });
    const store = createMessageStore(adapter);
    useInAppNotification.getState().dismiss();
    await store.getState().initialize("token");
    receiveMessage?.(
      "42",
      { ...sentMessage, isMine: false, sentAt: Date.now() + 1_000 },
      conversation,
    );
    expect(useInAppNotification.getState().notification).toMatchObject({
      peerId: "42",
    });
    await store.getState().reset();
  });

  it("does not show in-app banner for messages arriving before the session is ready", async () => {
    let receiveMessage:
      | Parameters<MessageAdapter["subscribeMessages"]>[0]
      | undefined;
    let completeSnapshot!: (value: MessageConversation[]) => void;
    const adapter = makeAdapter({
      getConversations: vi.fn(
        () =>
          new Promise<MessageConversation[]>((resolve) => {
            completeSnapshot = resolve;
          }),
      ),
      subscribeMessages: (listener) => {
        receiveMessage = listener;
        return () => undefined;
      },
    });
    const store = createMessageStore(adapter);
    useInAppNotification.getState().dismiss();
    // 登录中（会话未就绪）收到的消息属于离线补偿，不弹横幅
    const initializing = store.getState().initialize("token");
    await vi.waitFor(() => expect(completeSnapshot).toBeDefined());
    receiveMessage?.(
      "42",
      { ...sentMessage, isMine: false, sentAt: Date.now() },
      conversation,
    );
    expect(useInAppNotification.getState().notification).toBeNull();
    expect(store.getState().conversations[0]).toMatchObject({
      id: "42",
      unreadCount: 1,
    });
    completeSnapshot([]);
    await initializing;
    await store.getState().reset();
  });

  it("does not surface a terminal signal while initialization is still running", async () => {
    // reload 后连接前的状态轮询可能广播上一个会话残留的 terminal 状态，
    // 初始化未完成时不落错误态，最终状态由 initialize 自己的结果决定
    let statusListener:
      | ((signal: "connected" | "connecting" | "terminal" | "timeout") => void)
      | undefined;
    let completeSnapshot!: (value: MessageConversation[]) => void;
    const adapter = makeAdapter({
      getConversations: vi.fn(
        () =>
          new Promise<MessageConversation[]>((resolve) => {
            completeSnapshot = resolve;
          }),
      ),
      subscribeConnectionStatus: vi.fn((listener) => {
        statusListener = listener;
        return () => undefined;
      }),
    });
    const store = createMessageStore(adapter);
    const initializing = store.getState().initialize("token");
    await vi.waitFor(() => expect(statusListener).toBeDefined());
    statusListener?.("terminal");
    expect(store.getState().connectionState).toBe("connecting");
    completeSnapshot([]);
    await initializing;
    expect(store.getState().connectionState).toBe("ready");
    await store.getState().reset();
  });

  it("surfaces a terminal signal after the session is ready with a friendlier copy", async () => {
    let statusListener:
      | ((signal: "connected" | "connecting" | "terminal" | "timeout") => void)
      | undefined;
    const adapter = makeAdapter({
      subscribeConnectionStatus: vi.fn((listener) => {
        statusListener = listener;
        return () => undefined;
      }),
    });
    const store = createMessageStore(adapter);
    await store.getState().initialize("token");
    statusListener?.("terminal");
    expect(store.getState().connectionState).toBe("error");
    expect(store.getState().lastError).toBe("消息服务连接中断，请稍后重试");
    await store.getState().reset();
  });

  it("shows a friendly connection error when initialization fails", async () => {
    const store = createMessageStore(
      makeAdapter({ initialize: vi.fn(async () => false) }),
    );
    await store.getState().initialize("token");
    expect(store.getState().connectionState).toBe("error");
    expect(store.getState().lastError).toBe("消息服务连接中断，请稍后重试");
  });

  it("creates the dispatch assistant conversation with a card preview when an invite arrives", async () => {
    let receiveMessage:
      | Parameters<MessageAdapter["subscribeMessages"]>[0]
      | undefined;
    const store = createMessageStore(
      makeAdapter({
        subscribeMessages: vi.fn((listener) => {
          receiveMessage = listener;
          return () => undefined;
        }),
      }),
    );
    await store.getState().initialize("token");
    const invite: ManagedMessage = {
      id: "cs-1",
      kind: "csInvite",
      roomId: "123",
      clubId: "45",
      roomVersion: "2",
      playerName: "小明",
      expireAt: 1_792_128_660,
      time: "10:00",
      isMine: false,
      status: "sent",
      sentAt: 20,
    };
    receiveMessage?.("rc_p_50000001", invite, {
      ...conversation,
      id: "rc_p_50000001",
      title: "50000001",
    });
    expect(store.getState().conversations[0]).toMatchObject({
      id: "rc_p_50000001",
      title: "派单助手",
      preview: "[接待邀请]",
      unreadCount: 1,
    });
    await store.getState().reset();
  });

  it("clears unread counts for every conversation and marks unread peers as read", async () => {
    const markRead = vi.fn(async () => true);
    const store = createMessageStore(
      makeAdapter({
        markRead,
        getConversations: vi.fn(async () => [
          { ...conversation, unreadCount: 2 },
          { ...conversation, id: "7", unreadCount: 0 },
        ]),
      }),
    );
    await store.getState().initialize("token");
    await store.getState().clearAllUnread();
    expect(
      store.getState().conversations.every((item) => item.unreadCount === 0),
    ).toBe(true);
    expect(markRead).toHaveBeenCalledTimes(1);
    expect(markRead).toHaveBeenCalledWith("42");
  });

  it("updates a conversation note and pin state without changing its message data", async () => {
    const store = createMessageStore(
      makeAdapter({ getConversations: vi.fn(async () => [conversation]) }),
    );
    await store.getState().initialize("token");
    store.getState().setConversationNote("42", "常用大神");
    await store.getState().setConversationPinned("42", true);
    expect(store.getState().conversations[0]).toMatchObject({
      id: "42",
      note: "常用大神",
      isPinned: true,
    });
  });

  it("syncs pin state to the adapter and rolls back when the adapter rejects", async () => {
    const setConversationPinned = vi.fn(async () => true);
    const store = createMessageStore(
      makeAdapter({
        getConversations: vi.fn(async () => [conversation]),
        setConversationPinned,
      }),
    );
    await store.getState().initialize("token");
    await store.getState().setConversationPinned("42", true);
    expect(setConversationPinned).toHaveBeenCalledWith("42", true);
    expect(store.getState().conversations[0]).toMatchObject({ isPinned: true });

    setConversationPinned.mockRejectedValueOnce(new Error("设置置顶失败（1）"));
    await store.getState().setConversationPinned("42", false);
    expect(store.getState().conversations[0]).toMatchObject({ isPinned: true });
    expect(store.getState().lastError).toBe("设置置顶失败（1）");
  });

  it("loads older history only once per cursor and prepends it", async () => {
    const older: ManagedMessage = {
      ...sentMessage,
      id: "old",
      sentAt: 1,
      time: "09:00",
    };
    const adapter = makeAdapter({
      getMessages: vi
        .fn()
        .mockResolvedValueOnce({
          messages: [sentMessage],
          nextCursor: 10,
          hasMore: true,
        })
        .mockResolvedValueOnce({
          messages: [older],
          nextCursor: null,
          hasMore: false,
        }),
    });
    const store = createMessageStore(adapter);
    await store.getState().initialize("token");
    await store.getState().openConversation({ id: "42", title: "Peer" });
    await store.getState().loadOlder("42");
    await store.getState().loadOlder("42");
    expect(adapter.getMessages).toHaveBeenCalledTimes(2);
    expect(
      store.getState().messagesByPeerId["42"].map((item) => item.id),
    ).toEqual(["old", "server-1"]);
  });

  it("refreshes online flags and reports success", async () => {
    const store = createMessageStore(
      makeAdapter({ getConversations: vi.fn(async () => [conversation]) }),
    );
    await store.getState().initialize("token");
    vi.mocked(clientAuthApi.getUserOnlineStatus).mockResolvedValueOnce({
      "42": 1,
    });

    await expect(store.getState().refreshOnlineStatuses("token")).resolves.toBe(
      true,
    );
    expect(store.getState().conversations[0].isOnline).toBe(true);
    await store.getState().reset();
  });

  it("keeps conversations reference when online flags do not change", async () => {
    const store = createMessageStore(
      makeAdapter({ getConversations: vi.fn(async () => [conversation]) }),
    );
    await store.getState().initialize("token");
    const before = store.getState().conversations;

    await store.getState().refreshOnlineStatuses("token");

    expect(store.getState().conversations).toBe(before);
    await store.getState().reset();
  });

  it("reports failure and keeps the previous snapshot when the request throws", async () => {
    const store = createMessageStore(
      makeAdapter({ getConversations: vi.fn(async () => [conversation]) }),
    );
    await store.getState().initialize("token");
    vi.mocked(clientAuthApi.getUserOnlineStatus).mockRejectedValueOnce(
      new Error("network"),
    );
    const before = store.getState().conversations;

    await expect(store.getState().refreshOnlineStatuses("token")).resolves.toBe(
      false,
    );
    expect(store.getState().conversations).toBe(before);
    await store.getState().reset();
  });

  it("scopes the refresh to the requested peer only", async () => {
    const other: MessageConversation = {
      id: "77",
      title: "Other",
      preview: "",
      time: "",
      unreadCount: 0,
      updatedAt: 1,
    };
    const store = createMessageStore(
      makeAdapter({
        getConversations: vi.fn(async () => [conversation, other]),
      }),
    );
    await store.getState().initialize("token");
    // initialize 会规范化会话对象，作用域外对比用初始化后的快照
    const otherSnapshot = store.getState().conversations[1];
    vi.mocked(clientAuthApi.getUserOnlineStatus).mockResolvedValueOnce({
      "42": 1,
    });

    await expect(
      store.getState().refreshOnlineStatuses("token", "42"),
    ).resolves.toBe(true);

    expect(clientAuthApi.getUserOnlineStatus).toHaveBeenLastCalledWith(
      "token",
      ["42"],
    );
    expect(store.getState().conversations[0].isOnline).toBe(true);
    // 作用域外的会话保持原对象不动
    expect(store.getState().conversations[1]).toBe(otherSnapshot);
    await store.getState().reset();
  });

  it("records the scoped peer status even when the conversation is not in the list", async () => {
    const store = createMessageStore(
      makeAdapter({ getConversations: vi.fn(async () => []) }),
    );
    await store.getState().initialize("token");
    vi.mocked(clientAuthApi.getUserOnlineStatus).mockResolvedValueOnce({
      "42": 1,
    });

    await expect(
      store.getState().refreshOnlineStatuses("token", "42"),
    ).resolves.toBe(true);

    // 聊天页头部不依赖会话行：对端状态按 id 单独留存
    expect(store.getState().peerOnlineById["42"]).toBe(true);
    await store.getState().reset();
    expect(store.getState().peerOnlineById).toEqual({});
  });
});
