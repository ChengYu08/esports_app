import { storage } from "@/core/storage/storage";

const TEEN_POPUP_CACHE_KEY = "mine:teen-popup";
const TEEN_ENABLED_MIRROR_KEY = "mine:teen-enabled-mirror";

export type TeenPopupCache = {
  /** 勾选了"后续不再重复弹出"：永久不再弹（删除缓存后重新触发）。 */
  dontAsk: boolean;
  /** 最近一次弹窗关闭的日期（本地时区 YYYY-MM-DD）：当日不再弹。 */
  lastDismissedDate?: string;
};

export type TeenPopupCachePatch = {
  dontAsk?: boolean;
  lastDismissedDate?: string;
};

export async function readTeenPopupCache(): Promise<TeenPopupCache> {
  const raw = await storage.get(TEEN_POPUP_CACHE_KEY);
  if (!raw) {
    return { dontAsk: false };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<TeenPopupCache>;
    return {
      dontAsk: parsed.dontAsk === true,
      lastDismissedDate:
        typeof parsed.lastDismissedDate === "string"
          ? parsed.lastDismissedDate
          : undefined,
    };
  } catch {
    return { dontAsk: false };
  }
}

export async function saveTeenPopupCache(patch: TeenPopupCachePatch) {
  const current = await readTeenPopupCache();
  const next: TeenPopupCache = {
    dontAsk: patch.dontAsk ?? current.dontAsk,
    lastDismissedDate: patch.lastDismissedDate ?? current.lastDismissedDate,
  };
  await storage.set(TEEN_POPUP_CACHE_KEY, JSON.stringify(next));
}

/** 最近一次已知的服务端开启状态镜像（基础设置行展示用；以服务端 /youth/status 为准）。 */
export async function readLastTeenEnabled(): Promise<boolean | null> {
  const raw = await storage.get(TEEN_ENABLED_MIRROR_KEY);
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  return null;
}

export async function saveLastTeenEnabled(enabled: boolean) {
  await storage.set(TEEN_ENABLED_MIRROR_KEY, enabled ? "true" : "false");
}
