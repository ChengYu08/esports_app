import { create } from 'zustand';

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
