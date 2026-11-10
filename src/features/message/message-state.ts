import type { ChatMessage } from "./chat-message";

export type MessageDeliveryStatus = "pending" | "sent" | "failed";

export type ManagedMessage = ChatMessage & {
  status: MessageDeliveryStatus;
  clientId?: string;
  sentAt: number;
  /** 融云离线补偿（offline=true）补回来的消息，已读状态以服务端会话快照为准 */
  receivedOffline?: boolean;
  retryPayload?:
    | { kind: "text"; text: string }
    | { kind: "image"; path: string };
  mediaSource?: unknown;
};

export type MessageConversation = {
  id: string;
  title: string;
  preview: string;
  time: string;
  avatar?: string;
  unreadCount: number;
  updatedAt: number;
  isOnline?: boolean;
  clubId?: string;
  note?: string;
  isPinned?: boolean;
  isCustomerService?: boolean;
};

export type MessageHistoryPage = {
  messages: ManagedMessage[];
  nextCursor: number | null;
  hasMore: boolean;
};

export function mergeConversationPair(
  current: MessageConversation | undefined,
  updated: MessageConversation,
): MessageConversation {
  const hasNewerMessage =
    !current ||
    updated.updatedAt > current.updatedAt ||
    (updated.updatedAt === current.updatedAt &&
      Boolean(updated.preview || updated.time));
  return {
    ...current,
    ...updated,
    title:
      current?.isCustomerService && updated.isCustomerService === undefined
        ? current.title
        : updated.title,
    preview: hasNewerMessage ? updated.preview : current.preview,
    time: hasNewerMessage ? updated.time : current.time,
    updatedAt: Math.max(current?.updatedAt || 0, updated.updatedAt),
    // 只升不降：本地已读清零可能比融云快照/其他端状态更新，快照回灌不能吞掉实时累加的未读
    unreadCount: Math.max(current?.unreadCount || 0, updated.unreadCount),
    clubId: updated.clubId ?? current?.clubId,
    note: updated.note ?? current?.note,
    isPinned: updated.isPinned ?? current?.isPinned,
    ...(updated.isCustomerService !== undefined ||
    current?.isCustomerService !== undefined
      ? {
          isCustomerService:
            updated.isCustomerService ?? current?.isCustomerService,
        }
      : {}),
  };
}

export function mergeConversations(
  items: MessageConversation[],
  updated: MessageConversation,
) {
  const merged = mergeConversationPair(
    items.find((item) => item.id === updated.id),
    updated,
  );
  return [...items.filter((item) => item.id !== updated.id), merged].sort(
    (left, right) =>
      Number(Boolean(right.isPinned)) - Number(Boolean(left.isPinned)) ||
      right.updatedAt - left.updatedAt,
  );
}

/**
 * 快照合并结果与现有会话逐字段比较：内容完全一致时调用方复用原对象、跳过更新，
 * 避免每次列表刷新都生成全新会话数组导致整列重渲染。
 */
export function isConversationContentEqual(
  current: MessageConversation | undefined,
  merged: MessageConversation,
) {
  if (!current) return false;
  return current.title === merged.title
    && current.preview === merged.preview
    && current.time === merged.time
    && current.avatar === merged.avatar
    && current.unreadCount === merged.unreadCount
    && current.updatedAt === merged.updatedAt
    && current.isOnline === merged.isOnline
    && current.clubId === merged.clubId
    && current.note === merged.note
    && current.isPinned === merged.isPinned
    && current.isCustomerService === merged.isCustomerService;
}

function messageKey(item: ManagedMessage) {
  return item.id || item.clientId;
}

function insertSortedMessage(
  items: ManagedMessage[],
  incoming: ManagedMessage,
) {
  const key = messageKey(incoming);
  if (!key) return items;

  const existingIndex = items.findIndex((item) => messageKey(item) === key);
  if (existingIndex >= 0 && items[existingIndex].sentAt === incoming.sentAt) {
    const next = items.slice();
    next[existingIndex] = incoming;
    return next;
  }

  const remaining =
    existingIndex >= 0
      ? items.filter((_, index) => index !== existingIndex)
      : items;
  let low = 0;
  let high = remaining.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (remaining[middle].sentAt <= incoming.sentAt) low = middle + 1;
    else high = middle;
  }

  return [...remaining.slice(0, low), incoming, ...remaining.slice(low)];
}

export function mergeMessages(
  items: ManagedMessage[],
  incoming: ManagedMessage,
) {
  return insertSortedMessage(items, incoming);
}

export function prependHistory(
  items: ManagedMessage[],
  history: ManagedMessage[],
) {
  const existingKeys = new Set(
    items.map(messageKey).filter((key): key is string => Boolean(key)),
  );
  const uniqueHistory: ManagedMessage[] = [];
  for (const item of history) {
    const key = messageKey(item);
    if (!key || existingKeys.has(key)) continue;
    existingKeys.add(key);
    uniqueHistory.push(item);
  }

  const merged: ManagedMessage[] = [];
  let historyIndex = 0;
  let itemIndex = 0;
  while (historyIndex < uniqueHistory.length && itemIndex < items.length) {
    if (uniqueHistory[historyIndex].sentAt <= items[itemIndex].sentAt) {
      merged.push(uniqueHistory[historyIndex]);
      historyIndex += 1;
    } else {
      merged.push(items[itemIndex]);
      itemIndex += 1;
    }
  }
  merged.push(...uniqueHistory.slice(historyIndex), ...items.slice(itemIndex));
  return merged;
}

export function replacePendingMessage(
  items: ManagedMessage[],
  clientId: string,
  sent: ManagedMessage,
) {
  if (!items.some((item) => item.clientId === clientId)) return items;
  const sentKey = messageKey(sent);
  const remaining = items.filter(
    (item) => item.clientId !== clientId && messageKey(item) !== sentKey,
  );
  return insertSortedMessage(remaining, sent);
}

export function markMessageFailed(items: ManagedMessage[], clientId: string) {
  return items.map((item) =>
    item.clientId === clientId && item.status === "pending"
      ? { ...item, status: "failed" as const }
      : item,
  );
}
