export type AppTab = "index" | "order" | "message" | "mine";
export type ProtectedDestination = AppTab | "match";

const protectedTabs = new Set<AppTab>(["order", "message", "mine"]);

export function isProtectedTab(tab: AppTab): boolean {
  return protectedTabs.has(tab);
}

export function canOpenTab(tab: AppTab, isAuthenticated: boolean): boolean {
  return !isProtectedTab(tab) || isAuthenticated;
}

export type TabPressAction =
  | { type: "login"; replaceCurrentRoute: true }
  | { type: "navigate"; tab: AppTab };

export function getTabPressAction(
  tab: AppTab,
  isAuthenticated: boolean,
): TabPressAction {
  return canOpenTab(tab, isAuthenticated)
    ? { type: "navigate", tab }
    : { type: "login", replaceCurrentRoute: true };
}

export type ProtectedNavigationAction =
  | { type: "login"; replaceCurrentRoute: true }
  | { type: "navigate"; destination: ProtectedDestination };

export function getProtectedNavigationAction(
  destination: ProtectedDestination,
  isAuthenticated: boolean,
): ProtectedNavigationAction {
  if (destination === "index" || isAuthenticated) {
    return { type: "navigate", destination };
  }
  return { type: "login", replaceCurrentRoute: true };
}
