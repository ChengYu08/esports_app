import { describe, expect, it } from "vitest";

import type { Club } from "@/features/home/api/home.types";
import type { SearchUser } from "./api/search.api";
import { addSearchHistoryEntry, getSearchHistoryEntry, mergeLegacySearchHistory, parseSearchHistory } from "./search-history";
import { GLOBAL_SEARCH_HISTORY_KEY, loadGlobalSearchHistory } from "./search-history-storage";
import type { SearchHistoryEntry } from "./search-history";

const club: Club = {
  id: "1000003", clubCode: "1000003", name: "三角函数俱乐部",
  coverUrl: "https://example.com/club.png", description: "", memberCount: 5, onlineCount: 0,
};
const user: SearchUser = {
  profileId: 16, clubId: 1000003, userId: 50100028,
  nickname: "四川周杰伦", headImage: "https://example.com/user.png",
};

describe("search history", () => {
  it("reads legacy keywords and new avatar records without losing order", () => {
    expect(parseSearchHistory(JSON.stringify([
      " 旧关键词 ", { keyword: club.name, avatarUrl: club.coverUrl, entityId: club.id },
      null, 42, { keyword: "" }, "旧关键词",
    ]))).toEqual([
      { keyword: "旧关键词" },
      { keyword: club.name, avatarUrl: club.coverUrl, entityId: club.id },
    ]);
    expect(parseSearchHistory("invalid json")).toEqual([]);
    expect(parseSearchHistory('{"keyword":"test"}')).toEqual([]);
  });

  it("upgrades a keyword record and preserves its avatar when revisited", () => {
    const history = addSearchHistoryEntry([{ keyword: club.name }, { keyword: "其他" }], {
      keyword: club.name, avatarUrl: club.coverUrl, entityId: club.id,
    });
    const revisited = addSearchHistoryEntry(history, { keyword: club.name, entityId: club.id });

    expect(revisited).toHaveLength(2);
    expect(revisited[0]).toEqual({ keyword: club.name, avatarUrl: club.coverUrl, entityId: club.id });
    expect(parseSearchHistory(JSON.stringify(revisited))).toEqual(revisited);
  });

  it("keeps users with the same nickname distinct and limits history to ten", () => {
    const first = { keyword: user.nickname, avatarUrl: user.headImage, entityId: "1" };
    const second = { keyword: user.nickname, avatarUrl: "https://example.com/other.png", entityId: "2" };
    const sameName = addSearchHistoryEntry([first], second);
    expect(parseSearchHistory(JSON.stringify(sameName))).toEqual([second, first]);

    const history = Array.from({ length: 10 }, (_, i) => ({ keyword: String(i) }));
    expect(addSearchHistoryEntry(history, { keyword: "new" })).toEqual([{ keyword: "new" }, ...history.slice(0, 9)]);
  });

  it("recovers club and user avatars by exact name or ID", () => {
    expect(getSearchHistoryEntry(club.name, [club]).avatarUrl).toBe(club.coverUrl);
    expect(getSearchHistoryEntry(club.id, [club]).entityId).toBe(club.id);
    expect(getSearchHistoryEntry(user.nickname, [user]).avatarUrl).toBe(user.headImage);
    expect(getSearchHistoryEntry(String(user.userId), [user]).avatarUrl).toBe(user.headImage);
  });

  it("does not assign arbitrary avatars to broad or ambiguous keyword searches", () => {
    expect(getSearchHistoryEntry("三角", [club]).avatarUrl).toBeUndefined();
    const other = { ...user, userId: 50100029, headImage: "https://example.com/other.png" };
    expect(getSearchHistoryEntry(user.nickname, [user, other]).avatarUrl).toBeUndefined();
    expect(getSearchHistoryEntry(user.nickname, [user, other], String(other.userId)).avatarUrl).toBe(other.headImage);
  });

  it("keeps clubs and companions with the same ID or keyword in their own categories", () => {
    const clubEntry: SearchHistoryEntry = { keyword: "同名", entityId: "123", category: "club", avatarUrl: club.coverUrl };
    const userEntry: SearchHistoryEntry = { keyword: "同名", entityId: "123", category: "user", avatarUrl: user.headImage };
    const history = addSearchHistoryEntry([clubEntry], userEntry);
    expect(parseSearchHistory(JSON.stringify(history))).toEqual([userEntry, clubEntry]);
    const revisited = addSearchHistoryEntry(history, clubEntry);
    expect(revisited).toEqual([clubEntry, userEntry]);

    const keywords = addSearchHistoryEntry([{ keyword: "成都", category: "club" }], { keyword: "成都", category: "user" });
    expect(keywords).toHaveLength(2);
  });

  it("migrates both legacy lists with category information even when a list is full", () => {
    const clubs = JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ keyword: `俱乐部${i}`, entityId: String(i), avatarUrl: club.coverUrl })));
    const users = JSON.stringify(["旧陪玩关键词", { keyword: user.nickname, entityId: String(user.userId), avatarUrl: user.headImage }]);
    const merged = mergeLegacySearchHistory(clubs, users);
    expect(merged).toHaveLength(10);
    expect(merged.slice(0, 4)).toEqual([
      { keyword: "俱乐部0", entityId: "0", avatarUrl: club.coverUrl, category: "club" },
      { keyword: "旧陪玩关键词", category: "user" },
      { keyword: "俱乐部1", entityId: "1", avatarUrl: club.coverUrl, category: "club" },
      { keyword: user.nickname, entityId: String(user.userId), avatarUrl: user.headImage, category: "user" },
    ]);
  });

  it("persists migration once and does not restore old history after clearing", async () => {
    const values = new Map<string, string>([
      ["search.club.history", JSON.stringify([club.name])],
      ["search.user.history", JSON.stringify([user.nickname])],
    ]);
    const storage = {
      getItem: async (key: string) => values.get(key) ?? null,
      setItem: async (key: string, value: string) => { values.set(key, value); },
    };
    expect(await loadGlobalSearchHistory(storage)).toEqual([
      { keyword: club.name, category: "club" },
      { keyword: user.nickname, category: "user" },
    ]);
    expect(values.has(GLOBAL_SEARCH_HISTORY_KEY)).toBe(true);
    await storage.setItem(GLOBAL_SEARCH_HISTORY_KEY, "[]");
    expect(await loadGlobalSearchHistory(storage)).toEqual([]);
    expect(values.get("search.club.history")).toBe(JSON.stringify([club.name]));
  });
});
