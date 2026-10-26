import { create } from "zustand";

export type QuickMatchNoticeBarInvite = {
  key: string;
  requestNo: string;
  /** 单行条文案：「{buyer}」发布 {game·mode·level·service} 需求 */
  text: string;
  /** Unix ms 到期时刻 */
  expireAt: number;
};

type QuickMatchNoticeBarState = {
  invite: QuickMatchNoticeBarInvite | null;
  show: (invite: QuickMatchNoticeBarInvite) => void;
  dismiss: () => void;
};

export const useQuickMatchNoticeBar = create<QuickMatchNoticeBarState>((set) => ({
  invite: null,
  show: (invite) => set({ invite }),
  dismiss: () => set({ invite: null }),
}));
