import { create } from 'zustand';

import type { ChatMessage } from './chat-message';

/**
 * 已有独立 UI 承接（如 ActionNotice）的消息类型，不走顶部浮层。
 * 后续同类场景往集合里追加 kind 即可。
 */
export const IN_APP_BANNER_SUPPRESSED_KINDS = new Set<ChatMessage['kind']>([
  'orderNotify',
]);

export function shouldSuppressInAppBanner(kind: ChatMessage['kind']): boolean {
  return IN_APP_BANNER_SUPPRESSED_KINDS.has(kind);
}

export type InAppNotification = {
  key: string;
  peerId: string;
  title: string;
  preview: string;
  avatar?: string;
  isSystem: boolean;
};

type InAppNotificationState = {
  notification: InAppNotification | null;
  activePeerId: string | null;
  show: (notification: InAppNotification) => void;
  dismiss: () => void;
  setActivePeerId: (peerId: string | null) => void;
};

export const useInAppNotification = create<InAppNotificationState>((set) => ({
  notification: null,
  activePeerId: null,
  show: (notification) => set({ notification }),
  dismiss: () => set({ notification: null }),
  setActivePeerId: (peerId) => set({ activePeerId: peerId }),
}));

let notificationSequence = 0;

export function dispatchInAppNotification(input: {
  peerId: string;
  title: string;
  preview: string;
  avatar?: string;
  isSystem: boolean;
}) {
  notificationSequence += 1;
  useInAppNotification.getState().show({
    key: `notification-${Date.now()}-${notificationSequence}`,
    ...input,
  });
}
