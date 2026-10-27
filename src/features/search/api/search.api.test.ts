import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/core/network/api-client";
import { calculateAge } from "@/features/mine/profile-utils";
import { getSearchUserStatus } from "../search-user-status";
import { searchUsers } from "./search.api";

vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("companion search metadata", () => {
  it("keeps birthday, gender and status fields for the result card", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: {
        page: 1,
        totalPages: 1,
        records: [{
          profileId: 16, userId: 50100028, clubId: 1000003,
          nickname: "成都吴彦祖", birth: "2002-10-28", sex: 1,
          onlineStatus: 1, gameStatus: 1,
        }],
      },
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 27, 12));

    const { items } = await searchUsers("成都");

    expect(items[0]).toMatchObject({
      userId: 50100028, birth: "2002-10-28", sex: 1, onlineStatus: 1, gameStatus: 1,
    });
    expect(calculateAge(items[0].birth!)).toBe("23");
    expect(getSearchUserStatus(items[0].onlineStatus, items[0].gameStatus)).toBe("playing");
  });

  it("keeps missing status fields unknown so older responses can be hydrated", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      code: "SUCCESS",
      data: { records: [{ profileId: 16, userId: 50100028, sex: 2 }] },
    });

    const { items } = await searchUsers("50100028");

    expect(items[0].sex).toBe(2);
    expect(items[0].birth).toBeUndefined();
    expect(items[0].onlineStatus).toBeUndefined();
    expect(items[0].gameStatus).toBeUndefined();
    expect(getSearchUserStatus(items[0].onlineStatus, items[0].gameStatus)).toBeNull();
  });

  it("shows idle only while online and hides a stale game flag while offline", () => {
    expect(getSearchUserStatus(1, 0)).toBe("idle");
    expect(getSearchUserStatus(1, 1)).toBe("playing");
    expect(getSearchUserStatus(0, 1)).toBeNull();
    expect(getSearchUserStatus(0, 0)).toBeNull();
    expect(getSearchUserStatus(1, undefined)).toBeNull();
    expect(getSearchUserStatus()).toBeNull();
  });
});
