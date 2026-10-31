import { beforeEach, describe, expect, it, vi } from "vitest";
import { manipulateAsync } from "expo-image-manipulator";
import { getEvidenceUploadFile, preparePickedEvidenceImage } from "./court-evidence-image";

const fs = vi.hoisted(() => ({ files: new Map<string, Uint8Array>(), closes: vi.fn() }));
vi.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
  FileMode: { ReadOnly: "r" },
  File: class {
    uri: string;
    constructor(...parts: string[]) { this.uri = parts.join("/"); }
    get exists() { return fs.files.has(this.uri); }
    get size() { return fs.files.get(this.uri)?.length ?? 0; }
    open(mode: string) {
      expect(mode).toBe("r");
      return { readBytes: (length: number) => fs.files.get(this.uri)!.slice(0, length), close: fs.closes };
    }
    create() { fs.files.set(this.uri, new Uint8Array()); }
    write(data: string, options: { encoding: string }) {
      fs.files.set(this.uri, new Uint8Array(Buffer.from(data, "base64")));
    }
    delete() { fs.files.delete(this.uri); }
  },
}));
vi.mock("expo-image-manipulator", () => ({
  manipulateAsync: vi.fn(),
  SaveFormat: { JPEG: "jpeg" },
}));

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const heic = Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
const uri = "file:///photo.heic";
const convertedUri = "file:///cache/converted.jpg";

beforeEach(() => {
  fs.files.clear();
  fs.closes.mockClear();
  vi.mocked(manipulateAsync).mockReset();
});

describe("evidence image compatibility", () => {
  it("corrects the original HEIC filename when the bytes are already JPEG", () => {
    fs.files.set(uri, jpeg);
    expect(getEvidenceUploadFile(uri, "IMG_1234.HEIC")).toEqual({ uri, name: "IMG_1234.jpg", mimeType: "image/jpeg" });
    expect(fs.closes).toHaveBeenCalledOnce();
  });

  it.each([
    ["png", "image/png", png],
    ["gif", "image/gif", new Uint8Array(Buffer.from("GIF89a1234567"))],
    ["webp", "image/webp", new Uint8Array(Buffer.from("RIFF1234WEBP"))],
  ])("keeps supported %s bytes without converting", async (extension, mimeType, bytes) => {
    fs.files.set(uri, bytes);
    await expect(preparePickedEvidenceImage(uri))
      .resolves.toEqual({ uri, name: `photo.${extension}`, mimeType });
    expect(manipulateAsync).not.toHaveBeenCalled();
  });

  it("converts unsupported HEIC bytes to a JPEG cache file for upload", async () => {
    fs.files.set(uri, heic);
    fs.files.set(convertedUri, jpeg);
    vi.mocked(manipulateAsync).mockResolvedValue({ uri: convertedUri, width: 100, height: 100 });
    await expect(preparePickedEvidenceImage(uri)).resolves.toEqual({
      uri: convertedUri,
      name: "converted.jpg",
      mimeType: "image/jpeg",
    });
    expect(manipulateAsync).toHaveBeenCalledWith(uri, [], expect.anything());
  });

  it("propagates a failed conversion", async () => {
    fs.files.set(uri, heic);
    vi.mocked(manipulateAsync).mockRejectedValue(new Error("这张图片无法转换，请选择其他图片或截图后上传"));
    await expect(preparePickedEvidenceImage(uri)).rejects.toThrow("无法转换");
  });

  it("removes the converted file when it fails the upload-format check", async () => {
    fs.files.set(uri, heic);
    fs.files.set(convertedUri, heic);
    vi.mocked(manipulateAsync).mockResolvedValue({ uri: convertedUri, width: 100, height: 100 });
    await expect(preparePickedEvidenceImage(uri)).rejects.toThrow("图片格式暂不支持");
    expect(fs.files.has(convertedUri)).toBe(false);
  });

  it("rejects missing and empty files before upload", () => {
    expect(() => getEvidenceUploadFile(uri, "photo.jpg")).toThrow("读取图片失败");
    fs.files.set(uri, new Uint8Array());
    expect(() => getEvidenceUploadFile(uri, "photo.jpg")).toThrow("读取图片失败");
  });
});
