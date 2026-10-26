import {
  addBlacklistedUser,
  removeBlacklistedUser,
} from "@/features/mine/api/blacklist.api";
import { storage } from "@/core/storage/storage";

export type BlacklistEntry = {
  userId: string;
  nickname: string;
  headImage?: string;
  clubName?: string;
  clubId?: string;
};

const BLACKLIST_STORAGE_KEY = "esports.mine.blacklist";
type BlacklistListener = (entries: BlacklistEntry[]) => void;
const blacklistListeners = new Set<BlacklistListener>();

function notifyBlacklistChanged(entries: BlacklistEntry[]) {
  blacklistListeners.forEach((listener) => listener(entries));
}

export function subscribeBlacklist(listener: BlacklistListener) {
  blacklistListeners.add(listener);
  return () => blacklistListeners.delete(listener);
}

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

export async function isUserBlacklisted(userId: string | number): Promise<boolean> {
  const normalizedUserId = String(userId);
  const entries = await readBlacklist();
  return entries.some((entry) => entry.userId === normalizedUserId);
}

export async function addToBlacklist(entry: BlacklistEntry, token: string): Promise<void> {
  // 先写后端关联表，成功后再更新本地镜像（黑名单列表页/消息过滤仍读本地）
  await addBlacklistedUser(entry.userId, token);
  const current = await readBlacklist();
  const next = [entry, ...current.filter((item) => item.userId !== entry.userId)];
  await storage.set(BLACKLIST_STORAGE_KEY, JSON.stringify(next));
  notifyBlacklistChanged(next);
}

export async function removeFromBlacklist(userId: string, token: string): Promise<void> {
  // 先调后端解除，成功后再移除本地镜像
  await removeBlacklistedUser(userId, token);
  const current = await readBlacklist();
  const next = current.filter((item) => item.userId !== userId);
  await storage.set(BLACKLIST_STORAGE_KEY, JSON.stringify(next));
  notifyBlacklistChanged(next);
}
