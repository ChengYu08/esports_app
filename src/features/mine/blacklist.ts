import { storage } from "@/core/storage/storage";

export type BlacklistEntry = {
  userId: string;
  nickname: string;
  headImage?: string;
  clubName?: string;
  clubId?: string;
};

const BLACKLIST_STORAGE_KEY = "esports.mine.blacklist";

function isBlacklistEntry(value: unknown): value is BlacklistEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<BlacklistEntry>;
  return typeof entry.userId === "string" && entry.userId.length > 0;
}

export async function readBlacklist(): Promise<BlacklistEntry[]> {
  const value = await storage.get(BLACKLIST_STORAGE_KEY);
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBlacklistEntry);
  } catch {
    return [];
  }
}

export async function addToBlacklist(entry: BlacklistEntry): Promise<void> {
  const current = await readBlacklist();
  const next = [entry, ...current.filter((item) => item.userId !== entry.userId)];
  await storage.set(BLACKLIST_STORAGE_KEY, JSON.stringify(next));
}

export async function removeFromBlacklist(userId: string): Promise<void> {
  const current = await readBlacklist();
  await storage.set(
    BLACKLIST_STORAGE_KEY,
    JSON.stringify(current.filter((item) => item.userId !== userId)),
  );
}
