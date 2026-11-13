import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadVideoToVod } from "@/features/circle/vod-upload";
import type { VodUploadSign } from "@/features/circle/circle-publish.api";

vi.mock("expo-file-system", () => ({
  File: class {
    async bytes() {
      return new Uint8Array([1, 2, 3]);
    }
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadVideoToVod", () => {
  it("按 VOD 接口契约完成小视频直传", async () => {
    const calls: { url: string; method: string; body?: string; headers?: HeadersInit }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const parsed = new URL(url);
      calls.push({
        url,
        method: init.method ?? "GET",
        body: init.body as string | undefined,
        headers: init.headers,
      });
      if (parsed.searchParams.get("Action") === "ApplyUploadInfo") {
        return {
          ok: true,
          json: async () => ({
            Result: { Data: { UploadAddress: {
              StoreInfos: [{ Auth: "tos-auth", StoreUri: "object-key" }],
              UploadHosts: ["upload.example.com"],
              SessionKey: "session-key",
            } } },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ Result: { Data: { Vid: "video-id" } } }),
      };
    }));

    class UploadXhr {
      status = 200;
      responseText = '{"success":0}';
      upload: { onprogress?: (event: { loaded: number }) => void } = {};
      onload?: () => void;
      open() {}
      setRequestHeader() {}
      send() {
        this.upload.onprogress?.({ loaded: 3 });
        this.onload?.();
      }
    }
    vi.stubGlobal("XMLHttpRequest", UploadXhr);

    const sign: VodUploadSign = {
      accessKeyId: "ak",
      secretAccessKey: "sk",
      sessionToken: "token",
      currentTime: "2026-11-13T00:00:00Z",
      expiredTime: "2026-11-13T01:00:00Z",
      spaceName: "space",
      filename: "server-key.mp4",
      handlerTemplateId: "workflow",
    };
    const vid = await uploadVideoToVod({ uri: "file:///video.mp4", fileSize: 3, sign });

    expect(vid).toBe("video-id");
    const apply = new URL(calls[0].url);
    expect(calls[0].method).toBe("GET");
    expect(apply.searchParams.get("FileType")).toBe("video");
    expect(apply.searchParams.get("FileName")).toBe("server-key.mp4");
    const commit = new URL(calls[1].url);
    expect(calls[1].method).toBe("POST");
    expect(commit.searchParams.get("SessionKey")).toBeNull();
    expect((calls[1].headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    const body = new URLSearchParams(calls[1].body);
    expect(body.get("SessionKey")).toBe("session-key");
    expect(JSON.parse(body.get("Functions") ?? "[]")).toEqual([
      { Name: "StartWorkflow", Input: { TemplateId: "workflow" } },
    ]);
  });
});
