import { create } from "zustand";
import type { TicketTarget } from "./court.api";

type TargetSession = {
  ownerToken: string;
  initialTarget: TicketTarget | null;
  confirmedTarget: TicketTarget | null;
};

type TargetSelection = {
  sessions: Record<string, TargetSession>;
  begin: (id: string, ownerToken: string, target: TicketTarget | null) => void;
  confirm: (id: string, ownerToken: string, target: TicketTarget) => boolean;
  remove: (id: string) => void;
};

// 草稿选择仅保留在选择器内部；只有显式确认后才会更新表单。
export const useCourtTargetSelection = create<TargetSelection>((set, get) => ({
  sessions: {},
  begin: (id, ownerToken, target) => set((state) => ({
    sessions: { ...state.sessions, [id]: { ownerToken, initialTarget: target, confirmedTarget: null } },
  })),
  confirm: (id, ownerToken, target) => {
    const session = get().sessions[id];
    if (!session || !ownerToken || session.ownerToken !== ownerToken || !target.id.trim()) {
      return false;
    }
    set((state) => ({ sessions: { ...state.sessions, [id]: { ...session, confirmedTarget: target } } }));
    return true;
  },
  remove: (id) => set((state) => {
    const sessions = { ...state.sessions };
    delete sessions[id];
    return { sessions };
  }),
}));
