import { create } from "zustand";

export type AuthUser = { id: string; phone?: string };

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
