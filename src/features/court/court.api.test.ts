import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/core/network/api-client";
import { courtApi, courtServiceTypeText } from "./court.api";
import { clientAuthApi } from "@/features/auth/client-auth.api";
import { uploadClientObject } from "@/features/auth/oss-upload";

const session = vi.hoisted(() => ({ accessToken: null as string | null }));

vi.mock("@esports/auth", () => ({
  useAuthStore: { getState: () => session },
}));
vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));
vi.mock("@/features/auth/client-auth.api", () => ({ clientAuthApi: { getOssSts: vi.fn() } }));
vi.mock("@/features/auth/oss-upload", () => ({ uploadClientObject: vi.fn() }));

const request = vi.mocked(apiClient);

describe("evidence image upload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    session.accessToken = "viewer-token";
  });

  it("registers evidence ownership before uploading and returns the authorized key", async () => {
    const sts = { objectList: ["court/image.png"] };
    request.mockResolvedValue({ code: "SUCCESS", data: sts });
    await expect(courtApi.uploadEvidence("file:///image.png", "image.png")).resolves.toBe("court/image.png");
    expect(request).toHaveBeenCalledWith("/client/v1/court/evidence/sts", {
      method: "POST", token: "viewer-token", body: { action: { objectNames: ["image.png"] } },
    });
    expect(uploadClientObject).toHaveBeenCalledWith(sts, "court/image.png", { uri: "file:///image.png", mimeType: "image/png" });
    expect(clientAuthApi.getOssSts).not.toHaveBeenCalled();
  });

  it("uses the Web evidence business type for the legacy fallback", async () => {
    request.mockRejectedValue(new Error("unavailable"));
    vi.mocked(clientAuthApi.getOssSts).mockResolvedValue({ objectList: ["court/fallback.png"] } as Awaited<ReturnType<typeof clientAuthApi.getOssSts>>);
    await expect(courtApi.uploadEvidence("file:///image.png", "image.png")).resolves.toBe("court/fallback.png");
    expect(clientAuthApi.getOssSts).toHaveBeenCalledWith("viewer-token", "111", ["image.png"]);
  });

  it("refreshes credentials and returns the new key after a failed upload", async () => {
    request.mockResolvedValueOnce({ code: "SUCCESS", data: { objectList: ["old.png"] } })
      .mockResolvedValueOnce({ code: "SUCCESS", data: { objectList: ["new.png"] } });
    vi.mocked(uploadClientObject).mockRejectedValueOnce(new Error("expired")).mockResolvedValueOnce("url");
    await expect(courtApi.uploadEvidence("file:///image.png", "image.png")).resolves.toBe("new.png");
    expect(uploadClientObject).toHaveBeenCalledTimes(2);
  });

  it("does not upload without an authorized object key", async () => {
    request.mockResolvedValue({ code: "SUCCESS", data: {} });
    await expect(courtApi.uploadEvidence("file:///image.png", "image.png")).rejects.toThrow("上传凭证缺少文件路径");
    expect(uploadClientObject).not.toHaveBeenCalled();
  });
});

describe("platform ticket API contract", () => {
  beforeEach(() => {
    request.mockReset();
    session.accessToken = "viewer-token";
  });

  it("uses the Web target-search endpoint and forwards cancellation", async () => {
    const signal = new AbortController().signal;
    request.mockResolvedValue({ code: "SUCCESS", data: [{ id: "200100", nickname: "三角洲" }] });
    expect(await courtApi.searchTargets("三角洲", signal)).toEqual([{ id: "200100", nickname: "三角洲" }]);
    expect(request).toHaveBeenCalledWith(`/client/v1/platform-ticket/target/search?keyword=${encodeURIComponent("三角洲")}`, {
      method: "GET", token: "viewer-token", signal,
    });
  });

  it("preserves the provided idempotency key and string target ID on creation", async () => {
    request.mockResolvedValue({ code: "SUCCESS", data: { ticketId: 42 } });
    const input = { reasonType: "RULE_VIOLATION", targetUid: "9007199254740993", content: "投诉内容", evidenceObjectKeys: ["evidence.png"], idempotencyKey: "stable-key" };
    expect(await courtApi.createTicket(input)).toEqual({ ticketId: 42 });
    expect(request).toHaveBeenCalledWith("/client/v1/platform-ticket/create", { method: "POST", token: "viewer-token", body: input });
  });

  it("sends a suggestion without inventing a target ID", async () => {
    request.mockResolvedValue({ code: "SUCCESS", data: {} });
    await courtApi.createTicket({ reasonType: "PLATFORM_SUGGESTION", content: "建议", evidenceObjectKeys: [] });
    expect(request.mock.calls[0][1]?.body).not.toHaveProperty("targetUid");
  });

  it("uses the Web resubmit envelope and keeps original evidence separately", async () => {
    request.mockResolvedValue({ code: "SUCCESS", data: {} });
    const input = { reasonType: "OTHER", targetUid: "123", content: "补充内容", evidenceObjectKeys: ["new.png"], idempotencyKey: "retry-key" };
    await courtApi.resubmitTicket("42", input, ["original.png"]);
    expect(request).toHaveBeenCalledWith("/client/v1/platform-ticket/resubmit", {
      method: "POST", token: "viewer-token",
      body: { ticketId: "42", form: input, retainedEvidenceKeys: ["original.png"], idempotencyKey: "retry-key" },
    });
  });

  it("propagates business errors instead of navigating to success", async () => {
    request.mockResolvedValue({ code: "FAIL", info: "该诉告对象不可投诉" });
    await expect(courtApi.createTicket({ reasonType: "OTHER", targetUid: "123", content: "内容", evidenceObjectKeys: [] })).rejects.toThrow("该诉告对象不可投诉");
  });

  it.each([
    ["createTicket", () => courtApi.createTicket({ reasonType: "PLATFORM_SUGGESTION", content: "建议", evidenceObjectKeys: [] })],
    ["resubmitTicket", () => courtApi.resubmitTicket("42", { reasonType: "OTHER", content: "内容", evidenceObjectKeys: [] }, [])],
    ["vote", () => courtApi.vote(42, "FIRST", "DEFENDANT_WIN")],
  ])("rejects %s when success carries no data", async (_name, action) => {
    request.mockResolvedValue({ code: "SUCCESS", info: "操作成功" });
    await expect(action()).rejects.toThrow();
  });

  it("keeps void POST endpoints lenient when success carries no data", async () => {
    request.mockResolvedValue({ code: "SUCCESS", info: "操作成功" });

    await expect(courtApi.applyReviewer()).resolves.toBeUndefined();
    await expect(courtApi.replyTicket(42, "已收到")).resolves.toBeUndefined();
  });
});

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

describe("courtServiceTypeText", () => {
  it("joins mode, level and service name then appends the time-based amount", () => {
    expect(
      courtServiceTypeText({
        modeName: "带飞",
        levelName: "王者",
        serviceName: "陪玩",
        totalPrice: 88,
        quantity: 2,
        unitDurationMinutes: 60,
      }),
    ).toBe("带飞-王者-陪玩 88钻石-2小时");
  });

  it("uses the billing unit name when the service has no per-unit duration", () => {
    expect(
      courtServiceTypeText({
        modeName: "上分",
        serviceName: "陪玩",
        totalPrice: 30,
        quantity: 3,
        billingUnitName: "局",
      }),
    ).toBe("上分-陪玩 30钻石-3局");
  });

  it("falls back to the game name and omits the amount when the detail has no service fields", () => {
    expect(courtServiceTypeText({ gameName: "王者荣耀" })).toBe("王者荣耀");
    expect(courtServiceTypeText({})).toBe("服务订单");
  });

  it("drops empty service parts instead of producing stray separators", () => {
    expect(
      courtServiceTypeText({ modeName: " ", serviceName: "陪玩", totalPrice: 6 }),
    ).toBe("陪玩 6钻石");
  });

  it("formats minutes that are not whole hours as minutes", () => {
    expect(
      courtServiceTypeText({
        serviceName: "语音",
        totalPrice: 10,
        quantity: 2,
        unitDurationMinutes: 15,
      }),
    ).toBe("语音 10钻石-30分钟");
  });
});
