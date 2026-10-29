import { storage } from "@/core/storage/storage";

import type { TeenModeRecord } from "./teen-mode";

const TEEN_MODE_KEY = "mine:teen-mode";

export async function readTeenMode(): Promise<TeenModeRecord | null> {
  const raw = await storage.get(TEEN_MODE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TeenModeRecord>;
    if (typeof parsed.enabled !== "boolean" || typeof parsed.password !== "string") {
      return null;
    }
    return { enabled: parsed.enabled, password: parsed.password };
  } catch {
    return null;
  }
}

export async function saveTeenMode(record: TeenModeRecord) {
  await storage.set(TEEN_MODE_KEY, JSON.stringify(record));
}

export async function clearTeenMode() {
  await storage.remove(TEEN_MODE_KEY);
}
