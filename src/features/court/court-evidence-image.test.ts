import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEvidenceUploadFile, preparePickedEvidenceImage } from "./court-evidence-image";

const fs = vi.hoisted(() => ({ files: new Map<string, Uint8Array>(), closes: vi.fn(), writes: vi.fn() }));
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
      fs.writes(data, options);
      fs.files.set(this.uri, new Uint8Array(Buffer.from(data, "base64")));
    }
    delete() { fs.files.delete(this.uri); }
  },
}));

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const heic = Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
const uri = "file:///photo.heic";

beforeEach(() => {
  fs.files.clear();
  fs.closes.mockClear();
  fs.writes.mockReset();
});

describe("evidence image compatibility", () => {
  it("corrects Android's original HEIC filename when the picker has already exported JPEG", () => {
    fs.files.set(uri, jpeg);
    expect(getEvidenceUploadFile(uri, "IMG_1234.HEIC")).toEqual({ uri, name: "IMG_1234.jpg", mimeType: "image/jpeg" });
    expect(fs.closes).toHaveBeenCalledOnce();
  });

  it.each([
    ["png", "image/png", png],
    ["gif", "image/gif", new Uint8Array(Buffer.from("GIF89a1234567"))],
    ["webp", "image/webp", new Uint8Array(Buffer.from("RIFF1234WEBP"))],
  ])("keeps supported %s bytes instead of replacing them with the JPEG fallback", (extension, mimeType, bytes) => {
    fs.files.set(uri, bytes);
    expect(preparePickedEvidenceImage({ uri, fileName: "photo.HEIC", base64: Buffer.from(jpeg).toString("base64") }))
      .toEqual({ uri, name: `photo.${extension}`, mimeType });
    expect(fs.writes).not.toHaveBeenCalled();
  });

  it("writes the picker's real JPEG export for HEIC, leaving the original untouched", () => {
    fs.files.set(uri, heic);
    const result = preparePickedEvidenceImage({ uri, fileName: "IMG_1234.HEIC", base64: Buffer.from(jpeg).toString("base64") });
    expect(result).toMatchObject({ name: "IMG_1234.jpg", mimeType: "image/jpeg" });
    expect(result.uri).not.toBe(uri);
    expect(fs.files.get(result.uri)).toEqual(jpeg);
    expect(fs.files.get(uri)).toEqual(heic);
    expect(fs.writes).toHaveBeenCalledWith(Buffer.from(jpeg).toString("base64"), { encoding: "base64" });
    expect(fs.closes).toHaveBeenCalledTimes(2);
  });

  it("supplies a matching name when limited photo permission omits the filename", () => {
    fs.files.set(uri, png);
    expect(preparePickedEvidenceImage({ uri, fileName: null })).toMatchObject({ name: "photo.png", mimeType: "image/png" });
  });

  it("does not accept HEIC bytes just because the name says JPEG", () => {
    fs.files.set(uri, heic);
    expect(() => getEvidenceUploadFile(uri, "renamed.jpg")).toThrow("图片格式暂不支持");
  });

  it.each([null, "bm90IGFuIGltYWdl"])('rejects an unavailable or invalid conversion (%s)', (base64) => {
    fs.files.set(uri, heic);
    expect(() => preparePickedEvidenceImage({ uri, fileName: "photo.heic", base64 })).toThrow("无法转换");
    expect(fs.writes).not.toHaveBeenCalled();
  });

  it("removes an incomplete converted file after a write failure", () => {
    fs.files.set(uri, heic);
    fs.writes.mockImplementation(() => { throw new Error("disk full"); });
    expect(() => preparePickedEvidenceImage({ uri, base64: Buffer.from(jpeg).toString("base64") })).toThrow("disk full");
    expect([...fs.files.keys()]).toEqual([uri]);
  });

  it("rejects missing and empty files before upload", () => {
    expect(() => getEvidenceUploadFile(uri, "photo.jpg")).toThrow("读取图片失败");
    fs.files.set(uri, new Uint8Array());
    expect(() => getEvidenceUploadFile(uri, "photo.jpg")).toThrow("读取图片失败");
  });
});
