/**
 * 青少年模式首页促销弹窗的弹出规则（产品规则）：
 * - 勾选"后续不再重复弹出"（dontAsk）→ 永久不再弹；
 * - 未勾选 → 每个自然日首次启动弹一次（lastDismissedDate !== 今天即弹）；
 * - 无任何记录（首次/清缓存）→ 弹。
 */
export function shouldShowTeenPopup(
  cache: { dontAsk: boolean; lastDismissedDate?: string },
  today: string,
): boolean {
  if (cache.dontAsk) {
    return false;
  }
  return cache.lastDismissedDate !== today;
}

/** 本地时区的 YYYY-MM-DD（跨天判定以此为准）。 */
export function todayString(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
