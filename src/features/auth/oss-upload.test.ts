import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ClientOssSts } from "./client-auth.api";
import { uploadClientObject } from "./oss-upload";

const fileState = vi.hoisted(() => ({
  exists: true,
  type: null as string | null,
  bytes: vi.fn(),
}));

vi.mock("expo-file-system", () => ({
  File: class {
    get exists() { return fileState.exists; }
    get type() { return fileState.type; }
    bytes() { return fileState.bytes(); }
  },
}));

const sts: ClientOssSts = {
  endpoint: "https://oss.example.com",
  bucketName: "evidence",
  accessKeyId: "test-id",
  accessKeySecret: "test-secret",
  securityToken: "test-token",
  regionId: "test-region",
  domain: "https://cdn.example.com/",
};
const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  fileState.exists = true;
  fileState.type = null;
  fileState.bytes.mockResolvedValue(new Uint8Array([137, 80, 78, 71]));
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("OSS 图片请求体与签名", () => {
  it.each(["连接不返回", "错误响应体不返回"])("%s 时上传超时退出，不会一直占用加载状态", async (scenario) => {
    vi.useFakeTimers();
    const pending = new Promise(() => {});
    fetchMock.mockReturnValue(scenario === "连接不返回"
      ? pending : Promise.resolve({ ok: false, status: 500, text: () => pending }));
    let failure: unknown;
    const result = uploadClientObject(sts, "image.png", { uri: "file:///image" })
      .catch((error) => { failure = error; });
    await vi.advanceTimersByTimeAsync(60_001);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("上传超时");
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([null, "", "image/jpeg", "image/png"])(
    "文件类型为 %s 时仍使用签名中的类型和原始字节",
    async (fileType) => {
      fileState.type = fileType;
      await expect(uploadClientObject(sts, "court/证据.png", {
        uri: "file:///cache/image", mimeType: "image/png",
      })).resolves.toBe("https://cdn.example.com/court/证据.png");

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("https://evidence.oss.example.com/court/%E8%AF%81%E6%8D%AE.png");
      expect(options.method).toBe("PUT");
      // 字节请求体不会触发 Expo 的 Blob 类型请求头覆盖。
      expect(ArrayBuffer.isView(options.body)).toBe(true);
      expect(options.body).toEqual(new Uint8Array([137, 80, 78, 71]));
      expect(options.headers["Content-Type"]).toBe("image/png");
      expect(Object.values(options.headers).every((value) => typeof value === "string")).toBe(true);
      const signature = createHmac("sha1", sts.accessKeySecret)
        .update(`PUT\n\nimage/png\n${options.headers.Date}\nx-oss-forbid-overwrite:true\nx-oss-security-token:test-token\n/evidence/court/证据.png`)
        .digest("base64");
      expect(options.headers.Authorization).toBe(`OSS test-id:${signature}`);
    },
  );

  it("文件丢失时不发起上传", async () => {
    fileState.exists = false;
    await expect(uploadClientObject(sts, "image.png", { uri: "file:///missing" }))
      .rejects.toThrow("本地图片文件不存在");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("读取失败时不上传空文件", async () => {
    fileState.bytes.mockRejectedValue(new Error("读取失败"));
    await expect(uploadClientObject(sts, "image.png", { uri: "file:///image" }))
      .rejects.toThrow("读取失败");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("缺少临时凭证时不发起上传", async () => {
    await expect(uploadClientObject({ ...sts, securityToken: "" }, "image.png", { uri: "file:///image" }))
      .rejects.toThrow("上传凭证不完整");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("OSS 拒绝上传时保留错误供上层刷新凭证重试", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, text: async () => "<Error>SignatureDoesNotMatch</Error>" });
    await expect(uploadClientObject(sts, "image.png", { uri: "file:///image" }))
      .rejects.toThrow("OSS 上传失败（403：SignatureDoesNotMatch）");
  });
});
