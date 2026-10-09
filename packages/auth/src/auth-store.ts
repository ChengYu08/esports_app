import { create } from "zustand";
import type { CompanionProfile } from "../../../src/types/companion";

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
  isCompanion: boolean;
  companionProfile: CompanionProfile | null;
  setSession: (session: { user: AuthUser; accessToken: string }) => void;
  setCompanionStatus: (isCompanion: boolean, profile: CompanionProfile | null) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isCompanion: false,
  companionProfile: null,
  setSession: (session) => set(session),
  setCompanionStatus: (isCompanion, profile) => set({ isCompanion, companionProfile: profile }),
  clearSession: () => set({ user: null, accessToken: null, isCompanion: false, companionProfile: null }),
}));
