import type { Club } from "@/features/home/api/home.types";
import type { SearchUser } from "./api/search.api";
import type { SearchCategory } from "./search.types";

export type SearchHistoryEntry = {
  keyword: string;
  avatarUrl?: string;
  entityId?: string;
  category?: SearchCategory;
};

const MAX_HISTORY = 10;

/**
 * 关键词记录跨分类视为同一条（同一搜索词在两个 tab 下只留一条）；
 * 带实体 ID 的记录必须按分类区分，避免俱乐部与大神的同 ID 记录被合并。
 */
function isSameHistoryEntry(
  item: SearchHistoryEntry,
  entry: Pick<SearchHistoryEntry, "keyword" | "entityId" | "category">,
) {
  const keyword = entry.keyword.trim();
  if (!entry.entityId) {
    return !item.entityId && item.keyword === keyword;
  }
  return (
    item.category === entry.category &&
    (item.entityId === entry.entityId ||
      (!item.entityId && item.keyword === keyword))
  );
}

export function addSearchHistoryEntry(
  history: SearchHistoryEntry[],
  entry: SearchHistoryEntry,
) {
  const keyword = entry.keyword.trim();
  if (!keyword) {
    return history;
  }
  const isSameEntry = (item: SearchHistoryEntry) =>
    isSameHistoryEntry(item, entry);
  const previous = history.find(isSameEntry);
  return [
    {
      keyword,
      avatarUrl: entry.avatarUrl || previous?.avatarUrl,
      entityId: entry.entityId,
      category: entry.category,
    },
    ...history.filter((item) => !isSameEntry(item)),
  ].slice(0, MAX_HISTORY);
}

/** Accept the previous string-only format without discarding existing history. */
export function parseSearchHistory(
  value: string | null,
  fallbackCategory?: SearchCategory,
): SearchHistoryEntry[] {
  try {
    const entries: unknown = JSON.parse(value ?? "[]");
    if (!Array.isArray(entries)) {
      return [];
    }
    const history: SearchHistoryEntry[] = [];
    for (const entry of entries) {
      const keyword = typeof entry === "string" ? entry : entry?.keyword;
      if (typeof keyword !== "string" || !keyword.trim()) {
        continue;
      }
      const entityId =
        typeof entry?.entityId === "string" ? entry.entityId : undefined;
      const category =
        entry?.category === "club" || entry?.category === "user"
          ? entry.category
          : fallbackCategory;
      const parsed: SearchHistoryEntry = {
        keyword: keyword.trim(),
        avatarUrl:
          typeof entry?.avatarUrl === "string" ? entry.avatarUrl : undefined,
        entityId,
        category,
      };
      if (history.some((item) => isSameHistoryEntry(item, parsed))) {
        continue;
      }
      history.push(parsed);
      if (history.length === MAX_HISTORY) {
        break;
      }
    }
    return history;
  } catch {
    return [];
  }
}

/** Old per-category lists have no timestamps; interleave them to retain both. */
export function mergeLegacySearchHistory(
  clubs: string | null,
  users: string | null,
) {
  const clubHistory = parseSearchHistory(clubs, "club");
  const userHistory = parseSearchHistory(users, "user");
  const merged: SearchHistoryEntry[] = [];
  const append = (entry: SearchHistoryEntry) => {
    if (!merged.some((item) => isSameHistoryEntry(item, entry))) {
      merged.push(entry);
    }
  };
  for (
    let index = 0;
    index < Math.max(clubHistory.length, userHistory.length);
    index += 1
  ) {
    if (clubHistory[index]) {
      append(clubHistory[index]);
    }
    if (userHistory[index]) {
      append(userHistory[index]);
    }
  }
  return merged.slice(0, MAX_HISTORY);
}

/** A broad keyword must not pick an arbitrary club/user's avatar. */
export function getSearchHistoryEntry(
  keyword: string,
  results: readonly (Club | SearchUser)[],
  entityId?: string,
): SearchHistoryEntry {
  const normalized = keyword.trim().toLocaleLowerCase();
  const matches = results.filter((item) => {
    if (entityId) {
      return ("name" in item ? item.id : String(item.userId)) === entityId;
    }
    if ("name" in item) {
      return (
        item.name.toLocaleLowerCase() === normalized ||
        item.id === normalized ||
        item.clubCode === normalized
      );
    }
    return (
      item.nickname.toLocaleLowerCase() === normalized ||
      String(item.userId) === normalized
    );
  });
  const match = matches.length === 1 ? matches[0] : undefined;
  return {
    keyword: keyword.trim(),
    avatarUrl: match
      ? "name" in match
        ? match.coverUrl
        : match.headImage
      : undefined,
    entityId: match
      ? "name" in match
        ? match.id
        : String(match.userId)
      : undefined,
  };
}
