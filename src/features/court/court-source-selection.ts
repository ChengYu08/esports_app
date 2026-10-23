import { create } from "zustand";
import type { CourtCaseType, CourtSource } from "./court.api";

export type CourtSourceSelection = {
  caseType: CourtCaseType;
  ownerToken: string;
  orderId: string | null;
  reviewId: string | null;
  confirmedSource: CourtSource | null;
};

type SelectionState = {
  sessions: Record<string, CourtSourceSelection>;
  begin: (id: string, caseType: CourtCaseType, ownerToken: string, source: CourtSource | null) => void;
  selectOrder: (id: string, orderId: string) => void;
  selectReview: (id: string, reviewId: string) => void;
  confirm: (id: string, source: CourtSource, ownerToken: string) => boolean;
  remove: (id: string) => void;
};

// 每个表单持有自己的选择会话。只有确认后的选择才会被返回；
// 在任一选择器中退出，都不会改变表单已有的来源。
export const useCourtSourceSelection = create<SelectionState>((set, get) => ({
  sessions: {},
  begin: (id, caseType, ownerToken, source) => set((state) => ({
    sessions: {
      ...state.sessions,
      [id]: {
        caseType, ownerToken,
        orderId: source?.orderId == null ? null : String(source.orderId),
        reviewId: source?.reviewId == null ? null : String(source.reviewId),
        confirmedSource: null,
      },
    },
  })),
  selectOrder: (id, orderId) => set((state) => {
    const session = state.sessions[id];
    if (!session) {
      return state;
    }
    return { sessions: { ...state.sessions, [id]: {
      ...session, orderId,
      reviewId: session.orderId === orderId ? session.reviewId : null,
    } } };
  }),
  selectReview: (id, reviewId) => set((state) => {
    const session = state.sessions[id];
    if (!session) {
      return state;
    }
    return { sessions: { ...state.sessions, [id]: { ...session, reviewId } } };
  }),
  confirm: (id, source, ownerToken) => {
    const session = get().sessions[id];
    if (!session || session.ownerToken !== ownerToken || source.orderId == null ||
      String(source.orderId) !== session.orderId ||
      (session.caseType === "DELETE_REVIEW" &&
        (source.reviewId == null || String(source.reviewId) !== session.reviewId))) {
      return false;
    }
    set((state) => ({ sessions: { ...state.sessions, [id]: { ...session, confirmedSource: source } } }));
    return true;
  },
  remove: (id) => set((state) => {
    const sessions = { ...state.sessions };
    delete sessions[id];
    return { sessions };
  }),
}));
