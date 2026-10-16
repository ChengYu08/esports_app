import type { ChatMessage } from "./chat-message";

export type MessageDeliveryStatus = "pending" | "sent" | "failed";

export type ManagedMessage = ChatMessage & {
  status: MessageDeliveryStatus;
  clientId?: string;
  sentAt: number;
  retryPayload?: { kind: "text"; text: string } | { kind: "image"; path: string };
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
};

export type MessageHistoryPage = {
  messages: ManagedMessage[];
  nextCursor: number | null;
  hasMore: boolean;
};

export function mergeConversations(items: MessageConversation[], updated: MessageConversation) {
  const current = items.find((item) => item.id === updated.id);
  const hasNewerMessage = !current
    || updated.updatedAt > current.updatedAt
    || (updated.updatedAt === current.updatedAt && Boolean(updated.preview || updated.time));
  const merged = {
    ...current,
    ...updated,
    preview: hasNewerMessage ? updated.preview : current.preview,
    time: hasNewerMessage ? updated.time : current.time,
    updatedAt: Math.max(current?.updatedAt || 0, updated.updatedAt),
    clubId: updated.clubId ?? current?.clubId,
    note: updated.note ?? current?.note,
    isPinned: updated.isPinned ?? current?.isPinned,
  };
  return [...items.filter((item) => item.id !== updated.id), merged]
    .sort((left, right) => Number(Boolean(right.isPinned)) - Number(Boolean(left.isPinned)) || right.updatedAt - left.updatedAt);
}

function messageKey(item: ManagedMessage) {
  return item.id || item.clientId;
}

function insertSortedMessage(items: ManagedMessage[], incoming: ManagedMessage) {
  const key = messageKey(incoming);
  if (!key) return items;

  const existingIndex = items.findIndex((item) => messageKey(item) === key);
  if (existingIndex >= 0 && items[existingIndex].sentAt === incoming.sentAt) {
    const next = items.slice();
    next[existingIndex] = incoming;
    return next;
  }

  const remaining = existingIndex >= 0
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

export function mergeMessages(items: ManagedMessage[], incoming: ManagedMessage) {
  return insertSortedMessage(items, incoming);
}

export function prependHistory(items: ManagedMessage[], history: ManagedMessage[]) {
  const existingKeys = new Set(items.map(messageKey).filter((key): key is string => Boolean(key)));
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

export function replacePendingMessage(items: ManagedMessage[], clientId: string, sent: ManagedMessage) {
  if (!items.some((item) => item.clientId === clientId)) return items;
  const sentKey = messageKey(sent);
  const remaining = items.filter((item) =>
    item.clientId !== clientId && messageKey(item) !== sentKey,
  );
  return insertSortedMessage(remaining, sent);
}

export function markMessageFailed(items: ManagedMessage[], clientId: string) {
  return items.map((item) => item.clientId === clientId && item.status === "pending"
    ? { ...item, status: "failed" as const }
    : item);
}
