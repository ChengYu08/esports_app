import { create } from "zustand";

export type AuthUser = {
  id: string;
  nickname?: string;
  headImage?: string;
  phone?: string;
  gender?: number;
  birth?: string;
  signature?: string;
  isRealName?: number;
  realName?: string;
  idCardNo?: string;
  clubInfo?: { id: number; clubName: string; logoUrl: string; status: number; memberStatus: number } | null;
  positions?: { code: string; description: string }[];
  starBalance?: number | string;
};

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  setSession: (session: { user: AuthUser; accessToken: string }) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setSession: (session) => set(session),
  clearSession: () => set({ user: null, accessToken: null }),
}));
