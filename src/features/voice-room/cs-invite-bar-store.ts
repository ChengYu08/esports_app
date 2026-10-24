import { create } from "zustand";

export type CsInviteBarInvite = {
  key: string;
  roomId: string;
  clubId: string;
  roomVersion: string;
  playerUserId: string;
  playerName: string;
  /** Unix seconds，与服务端邀请有效期一致 */
  expireAt: number;
};

type CsInviteBarState = {
  invite: CsInviteBarInvite | null;
  show: (invite: CsInviteBarInvite) => void;
  dismiss: () => void;
};

export const useCsInviteBar = create<CsInviteBarState>((set) => ({
  invite: null,
  show: (invite) => set({ invite }),
  dismiss: () => set({ invite: null }),
}));
