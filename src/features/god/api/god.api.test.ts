import { expect, it, vi } from "vitest";

import { apiClient } from "@/core/network/api-client";
import { fetchGodPage, GOD_EMPTY_FILTERS } from "./god.api";

vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));

it("保留大神列表的陪玩标签并优先使用移动端背景色", async () => {
  vi.mocked(apiClient).mockResolvedValue({
    code: "SUCCESS",
    data: { records: [
      { userId: 1, clubId: 2, tagName: "明星打手", tagBackgroundColor: "#8F6B28" },
      { userId: 3, clubId: 4, tagName: "明星", tagBackgroundColor: "#138666", tagMobileBackgroundColor: "#FE4267" },
    ], total: 2 },
  });
  const result = await fetchGodPage({ gameId: null, filters: GOD_EMPTY_FILTERS, page: 1 });
  expect(result.items.map(({ tagName, tagColor }) => ({ tagName, tagColor }))).toEqual([
    { tagName: "明星打手", tagColor: "#8F6B28" },
    { tagName: "明星", tagColor: "#FE4267" },
  ]);
});
