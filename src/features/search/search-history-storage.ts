import { mergeLegacySearchHistory, parseSearchHistory } from "./search-history";

export const GLOBAL_SEARCH_HISTORY_KEY = "search.global.history.v2";

type HistoryStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
};

export async function loadGlobalSearchHistory(storage: HistoryStorage) {
  const saved = await storage.getItem(GLOBAL_SEARCH_HISTORY_KEY);
  if (saved !== null) {
    return parseSearchHistory(saved, "club");
  }
  const [clubs, users] = await Promise.all([
    storage.getItem("search.club.history"),
    storage.getItem("search.user.history"),
  ]);
  const history = mergeLegacySearchHistory(clubs, users);
  await storage.setItem(GLOBAL_SEARCH_HISTORY_KEY, JSON.stringify(history));
  return history;
}
