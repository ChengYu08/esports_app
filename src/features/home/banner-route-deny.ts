/**
 * Banner ROUTE 敏感路径黑名单。
 * 允许任意以 / 开头的 App 内路由投放；仅拦截不宜运营投放的账号/鉴权/系统内页。
 * 后续有不宜投放的内页时只追加本列表。
 */

export const BANNER_ROUTE_DENYLIST: readonly string[] = [
  "/forgot-password",
  "/change-password",
  "/account-cancellation",
  "/account-security",
  "/account-settings",
  "/basic-settings",
  "/teen-mode",
  "/edit-profile",
  "/edit-nickname",
  "/edit-signature",
  "/avatar-crop",
  "/media-picker",
  "/blacklist",
  "/message-notification",
  "/web-view",
] as const;

const denyExact = new Set(BANNER_ROUTE_DENYLIST);

/** 去掉末尾多余 /（根路径 "/" 除外），便于与黑名单 exact 比对。 */
function normalizeBannerRoutePath(path: string): string {
  if (path === "/") {
    return path;
  }
  return path.replace(/\/+$/, "");
}

/** jumpUrl 是否命中敏感路径黑名单。 */
export function isDeniedBannerRoute(path: string): boolean {
  return denyExact.has(normalizeBannerRoutePath(path));
}
