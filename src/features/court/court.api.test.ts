import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/core/network/api-client";
import { courtApi } from "./court.api";

const session = vi.hoisted(() => ({ accessToken: null as string | null }));

vi.mock("@esports/auth", () => ({
  useAuthStore: { getState: () => session },
}));
vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));
vi.mock("@/features/auth/oss-upload", () => ({ uploadClientObject: vi.fn() }));

const request = vi.mocked(apiClient);

describe("court viewer state", () => {
  beforeEach(() => {
    request.mockReset();
    session.accessToken = "viewer-token";
  });

  it.each(["ALL", "LATEST"] as const)("includes the viewer in the %s public feed", async (scope) => {
    request.mockResolvedValue({ code: "SUCCESS", data: { records: [] } });

    await courtApi.getPage(scope, 2, 20);

    expect(request).toHaveBeenCalledWith(
      `/client/v1/court/public/page?scope=${scope}&page=2&pageSize=20`,
      { method: "GET", token: "viewer-token" },
    );
  });

  it("reads personal state on public detail without using the party-only endpoint", async () => {
    request.mockResolvedValue({ code: "SUCCESS", data: { caseId: 42, favorited: true } });

    expect(await courtApi.getDetail(42)).toMatchObject({ favorited: true });
    expect(request).toHaveBeenCalledWith("/client/v1/court/public/detail?caseId=42", {
      method: "GET", token: "viewer-token",
    });
  });

  it("keeps public lists and details accessible to guests", async () => {
    session.accessToken = null;
    request.mockResolvedValue({ code: "SUCCESS", data: {} });

    await courtApi.getPage("ALL");
    await courtApi.getDetail(42);

    for (const [, options] of request.mock.calls) {
      expect(options).toEqual({ method: "GET" });
    }
  });

  it("uses the new session after an account change", async () => {
    request.mockResolvedValue({ code: "SUCCESS", data: { caseId: 42 } });
    await courtApi.getDetail(42);
    session.accessToken = "another-viewer-token";
    await courtApi.getDetail(42);

    expect(request).toHaveBeenLastCalledWith("/client/v1/court/public/detail?caseId=42", {
      method: "GET", token: "another-viewer-token",
    });
  });

  it("round-trips favorite state and counts through fresh list and detail reads", async () => {
    let favorited = false;
    let viewCount = 10;
    request.mockImplementation(async (path, options) => {
      if (path === "/client/v1/court/favorite") {
        favorited = (options?.body as { favorite: boolean }).favorite;
      }
      if (path.startsWith("/client/v1/court/public/detail")) {
        viewCount += 1;
      }
      const row = {
        caseId: 42,
        favorited: options?.token === "viewer-token" && favorited,
        favoriteCount: favorited ? 2 : 1,
        viewCount,
      };
      return {
        code: "SUCCESS",
        data: path.startsWith("/client/v1/court/public/page") ? { records: [row] } : row,
      };
    });

    await courtApi.getDetail(42);
    await courtApi.favorite(42, true);
    const list = await courtApi.getPage("ALL");
    expect(list.records?.[0]).toMatchObject({ favorited: true, favoriteCount: 2, viewCount: 11 });
    expect(await courtApi.getDetail(42)).toMatchObject({ favorited: true, favoriteCount: 2, viewCount: 12 });

    await courtApi.favorite(42, false);
    expect(await courtApi.getDetail(42)).toMatchObject({ favorited: false, favoriteCount: 1 });
  });
});

describe("court favorite responses", () => {
  beforeEach(() => {
    request.mockReset();
    session.accessToken = "viewer-token";
  });

  it.each([true, false])("retains the requested state %s when success has no payload", async (favorite) => {
    request.mockResolvedValue({ code: "SUCCESS" });

    expect(await courtApi.favorite("42", favorite)).toEqual({ favorited: favorite });
    expect(request).toHaveBeenCalledWith("/client/v1/court/favorite", {
      method: "POST", token: "viewer-token", body: { caseId: 42, favorite },
    });
  });

  it("preserves an explicit false state and zero count returned by the server", async () => {
    request.mockResolvedValue({ code: "SUCCESS", data: { favorited: false, favoriteCount: 0 } });

    expect(await courtApi.favorite(42, false)).toEqual({ favorited: false, favoriteCount: 0 });
  });

  it("does not report a failed favorite request as a successful local change", async () => {
    request.mockResolvedValue({ code: "FAIL", info: "收藏失败" });

    await expect(courtApi.favorite(42, true)).rejects.toThrow("收藏失败");
  });
});
