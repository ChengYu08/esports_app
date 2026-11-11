import { beforeEach, describe, expect, it, vi } from "vitest";
import * as MediaLibrary from "expo-media-library";

import { saveChatImageToAlbum } from "./save-chat-image";

const fs = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  copies: [] as { from: string; to: string }[],
  downloads: [] as { url: string; to: string }[],
}));
const env = vi.hoisted(() => ({ os: "android", version: 33 }));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return env.os;
    },
    get Version() {
      return env.version;
    },
  },
}));
vi.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
  FileMode: { ReadOnly: "r" },
  File: class {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts
        .map((part) => (typeof part === "string" ? part : part.uri))
        .join("/");
    }
    get exists() {
      return fs.files.has(this.uri);
    }
    get size() {
      return fs.files.get(this.uri)?.length ?? 0;
    }
    open() {
      return {
        readBytes: (length: number) => fs.files.get(this.uri)!.slice(0, length),
        close: vi.fn(),
      };
    }
    async copy(destination: { uri: string }) {
      fs.copies.push({ from: this.uri, to: destination.uri });
      fs.files.set(destination.uri, fs.files.get(this.uri)!);
    }
    static async downloadFileAsync(url: string, destination: { uri: string }) {
      fs.downloads.push({ url, to: destination.uri });
      return destination;
    }
  },
}));
vi.mock("expo-image-manipulator", () => ({
  ImageManipulator: { manipulate: vi.fn() },
  manipulateAsync: vi.fn(),
  SaveFormat: { JPEG: "jpeg" },
}));
vi.mock("expo-media-library", () => ({
  requestPermissionsAsync: vi.fn(),
  Asset: { create: vi.fn(async () => ({})) },
}));

const gifBytes = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
const jpegBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);

beforeEach(() => {
  fs.files.clear();
  fs.copies.length = 0;
  fs.downloads.length = 0;
  env.os = "android";
  env.version = 33;
  vi.mocked(MediaLibrary.Asset.create).mockClear();
  vi.mocked(MediaLibrary.requestPermissionsAsync).mockReset();
  vi.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValue({
    granted: true,
  } as Awaited<ReturnType<typeof MediaLibrary.requestPermissionsAsync>>);
});

describe("saveChatImageToAlbum", () => {
  it("融云本地文件是 GIF 但按 .jpg 命名时，按魔数纠正后缀再入相册", async () => {
    const localUri = "file:///rong/123456.jpg";
    fs.files.set(localUri, gifBytes);

    await saveChatImageToAlbum(localUri);

    expect(fs.copies).toEqual([
      { from: localUri, to: expect.stringMatching(/^file:\/\/\/cache\/chat-save-\d+\.gif$/) },
    ]);
    expect(MediaLibrary.Asset.create).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/cache\/chat-save-\d+\.gif$/),
    );
  });

  it("本地 JPEG 后缀正确时直接入相册，不复制文件", async () => {
    const localUri = "file:///rong/123456.jpg";
    fs.files.set(localUri, jpegBytes);

    await saveChatImageToAlbum(localUri);

    expect(fs.copies).toHaveLength(0);
    expect(MediaLibrary.Asset.create).toHaveBeenCalledWith(localUri);
  });

  it("远端 OSS 地址先下载到缓存，GIF 保留 .gif 后缀", async () => {
    await saveChatImageToAlbum("https://cdn.example.com/chat/a.gif");

    expect(fs.downloads).toEqual([
      { url: "https://cdn.example.com/chat/a.gif", to: expect.stringMatching(/\.gif$/) },
    ]);
    expect(MediaLibrary.Asset.create).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/cache\/chat-save-\d+\.gif$/),
    );
  });

  it("iOS 未授权写相册时抛出中文提示，不写文件", async () => {
    env.os = "ios";
    vi.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValue({
      granted: false,
    } as Awaited<ReturnType<typeof MediaLibrary.requestPermissionsAsync>>);

    await expect(
      saveChatImageToAlbum("file:///rong/123456.jpg"),
    ).rejects.toThrow("请在系统设置中允许盼之电竞访问相册");
    expect(MediaLibrary.Asset.create).not.toHaveBeenCalled();
  });
});
