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

function mergeById(items: ManagedMessage[]) {
  const messages = new Map<string, ManagedMessage>();
  for (const item of items) {
    const key = item.id || item.clientId;
    if (key) messages.set(key, item);
  }
  return [...messages.values()].sort((left, right) => left.sentAt - right.sentAt);
}

export function mergeMessages(items: ManagedMessage[], incoming: ManagedMessage) {
  return mergeById([...items, incoming]);
}

export function prependHistory(items: ManagedMessage[], history: ManagedMessage[]) {
  return mergeById([...history, ...items]);
}

export function replacePendingMessage(items: ManagedMessage[], clientId: string, sent: ManagedMessage) {
  return mergeById(items.map((item) => item.clientId === clientId ? sent : item));
}

export function markMessageFailed(items: ManagedMessage[], clientId: string) {
  return items.map((item) => item.clientId === clientId && item.status === "pending"
    ? { ...item, status: "failed" as const }
    : item);
}
