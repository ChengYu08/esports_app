import { storage } from "@/core/storage/storage";

import type { CoolingRecord } from "./cancellation-cooling";

const COOLING_KEY = "auth:cancellation-cooling";

export async function saveCoolingRecord(record: CoolingRecord) {
  await storage.set(COOLING_KEY, JSON.stringify(record));
}

export async function readCoolingRecord(): Promise<CoolingRecord | null> {
  const raw = await storage.get(COOLING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CoolingRecord;
  } catch {
    return null;
  }
}

export async function clearCoolingRecord() {
  await storage.remove(COOLING_KEY);
}
