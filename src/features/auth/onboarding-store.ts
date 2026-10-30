import { create } from "zustand";

import { storage } from "@/core/storage/storage";

const ONBOARDING_SKIPPED_KEY_PREFIX = "pzdj:onboarding:skipped:";
const ONBOARDING_DONE_KEY_PREFIX = "pzdj:onboarding:done:";

type OnboardingState = {
  skippedUsers: Set<string>;
  completedUsers: Set<string>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  markSkipped: (userId: string) => Promise<void>;
  markCompleted: (userId: string) => Promise<void>;
  isSkipped: (userId: string) => boolean;
  isCompleted: (userId: string) => boolean;
  shouldShowProfileOnboarding: (userId: string) => boolean;
};

async function readUserSet(prefix: string): Promise<Set<string>> {
  try {
    const raw = await storage.get(prefix);
    if (!raw) return new Set();
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

async function writeUserSet(prefix: string, set: Set<string>) {
  await storage.set(prefix, JSON.stringify(Array.from(set)));
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  skippedUsers: new Set<string>(),
  completedUsers: new Set<string>(),
  hydrated: false,

  hydrate: async () => {
    const [skipped, completed] = await Promise.all([
      readUserSet(ONBOARDING_SKIPPED_KEY_PREFIX),
      readUserSet(ONBOARDING_DONE_KEY_PREFIX),
    ]);
    set({ skippedUsers: skipped, completedUsers: completed, hydrated: true });
  },

  markSkipped: async (userId) => {
    const next = new Set(get().skippedUsers);
    next.add(userId);
    set({ skippedUsers: next });
    await writeUserSet(ONBOARDING_SKIPPED_KEY_PREFIX, next);
  },

  markCompleted: async (userId) => {
    const next = new Set(get().completedUsers);
    next.add(userId);
    set({ completedUsers: next });
    await writeUserSet(ONBOARDING_DONE_KEY_PREFIX, next);
  },

  isSkipped: (userId) => get().skippedUsers.has(userId),

  isCompleted: (userId) => get().completedUsers.has(userId),

  shouldShowProfileOnboarding: (userId) => {
    const state = get();
    return !state.completedUsers.has(userId) && !state.skippedUsers.has(userId);
  },
}));
