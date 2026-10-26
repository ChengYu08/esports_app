import type { ImageSource } from "expo-image";
import { create } from "zustand";

export const ACTION_NOTICE_MAX_ITEMS = 10;
/** 多条错层时单条占用高度（含间距） */
export const ACTION_NOTICE_STACK_OFFSET = 56;

export type ActionNoticeItem = {
  id: string;
  text: string;
  actionText: string;
  icon: ImageSource | number;
  /** Unix ms 到期时刻 */
  expireAt: number;
  maxDurationMs: number;
  minDurationMs?: number;
};

export type ActionNoticeHandlers = {
  onAction: () => void | Promise<void>;
  /** 条消失（到期/动作完成/被挤/被撤/clear）时调用（释放去重键等） */
  onDisappear?: () => void;
};

type ActionNoticeState = {
  items: ActionNoticeItem[];
};

const handlersById = new Map<string, ActionNoticeHandlers>();

function invokeDisappear(id: string) {
  const handlers = handlersById.get(id);
  handlersById.delete(id);
  handlers?.onDisappear?.();
}

function dropOldest(items: ActionNoticeItem[]): ActionNoticeItem[] {
  if (items.length === 0) return items;
  const [oldest, ...rest] = items;
  invokeDisappear(oldest.id);
  return rest;
}

export const useActionNoticeStore = create<ActionNoticeState>(() => ({
  items: [],
}));

function push(item: ActionNoticeItem, handlers: ActionNoticeHandlers) {
  handlersById.set(item.id, handlers);

  const { items } = useActionNoticeStore.getState();
  const index = items.findIndex((entry) => entry.id === item.id);
  if (index >= 0) {
    const next = items.slice();
    next[index] = item;
    useActionNoticeStore.setState({ items: next });
    return;
  }

  let next = [...items, item];
  while (next.length > ACTION_NOTICE_MAX_ITEMS) {
    next = dropOldest(next);
  }
  useActionNoticeStore.setState({ items: next });
}

function dismiss(id: string) {
  const { items } = useActionNoticeStore.getState();
  if (!items.some((entry) => entry.id === id)) return;
  invokeDisappear(id);
  useActionNoticeStore.setState({
    items: items.filter((entry) => entry.id !== id),
  });
}

function clear() {
  const { items } = useActionNoticeStore.getState();
  for (const item of items) {
    invokeDisappear(item.id);
  }
  useActionNoticeStore.setState({ items: [] });
}

export function getActionNoticeHandlers(id: string): ActionNoticeHandlers | undefined {
  return handlersById.get(id);
}

/** 测试专用：清空队列与 handler */
export function resetActionNoticeStore() {
  handlersById.clear();
  useActionNoticeStore.setState({ items: [] });
}

export const actionNotice = {
  push,
  dismiss,
  clear,
};
