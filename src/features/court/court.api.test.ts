import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/core/network/api-client";
import { courtApi } from "./court.api";
import { getEvidenceUploadFile } from "./court-evidence-image";
import { uploadClientObject } from "@/features/auth/oss-upload";

const session = vi.hoisted(() => ({ accessToken: null as string | null }));

vi.mock("@esports/auth", () => ({
  useAuthStore: { getState: () => session },
}));
vi.mock("@/core/network/api-client", () => ({ apiClient: vi.fn() }));
vi.mock("@/features/auth/oss-upload", () => ({ uploadClientObject: vi.fn() }));
vi.mock("@/features/court/court-evidence-image", () => ({ getEvidenceUploadFile: vi.fn() }));

const request = vi.mocked(apiClient);

describe("evidence image upload", () => {
  beforeEach(() => {
    request.mockReset();
    vi.mocked(getEvidenceUploadFile).mockReset();
    vi.mocked(uploadClientObject).mockReset();
    session.accessToken = "viewer-token";
  });

  it("uses the actual image format for both the STS filename and OSS Content-Type", async () => {
    const image = { uri: "file:///export.heic", name: "IMG_1001.jpg", mimeType: "image/jpeg" };
    vi.mocked(getEvidenceUploadFile).mockReturnValue(image);
    const sts = { objectList: ["court/evidence/IMG_1001.jpg"] };
    request.mockResolvedValue({ code: "SUCCESS", data: sts });

    expect(await courtApi.uploadEvidence(image.uri, "IMG_1001.HEIC")).toBe(sts.objectList[0]);
    expect(request).toHaveBeenCalledWith("/client/v1/court/evidence/sts", {
      method: "POST", token: "viewer-token", body: { action: { objectNames: ["IMG_1001.jpg"] } },
    });
    expect(uploadClientObject).toHaveBeenCalledWith(sts, sts.objectList[0], { uri: image.uri, mimeType: "image/jpeg" });
  });

  it("rejects unsupported files before requesting credentials or uploading", async () => {
    vi.mocked(getEvidenceUploadFile).mockImplementation(() => { throw new Error("图片格式暂不支持，请重新选择图片后上传"); });
    await expect(courtApi.uploadEvidence("file:///original.heic", "photo.jpg")).rejects.toThrow("请重新选择");
    expect(request).not.toHaveBeenCalled();
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
