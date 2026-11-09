import { describe, expect, it, vi } from "vitest";

import { clientAuthApi } from "@/features/auth/client-auth.api";
import { uploadClientObject } from "@/features/auth/oss-upload";
import { isGifImage } from "@/shared/media-picker/image-compat";

import { uploadChatImage } from "./chat-image-upload";

vi.mock("@/features/auth/client-auth.api", () => ({
  clientAuthApi: { getOssSts: vi.fn() },
}));
vi.mock("@/features/auth/oss-upload", () => ({
  uploadClientObject: vi.fn(),
}));
// 隔离 image-compat → expo-file-system/react-native 的原生依赖链
vi.mock("@/shared/media-picker/image-compat", () => ({ isGifImage: vi.fn(() => false) }));

const getOssSts = vi.mocked(clientAuthApi.getOssSts);
const upload = vi.mocked(uploadClientObject);
const isGif = vi.mocked(isGifImage);

describe("uploadChatImage", () => {
  it("获取 111 凭证后上传并返回公网 CDN 地址", async () => {
    getOssSts.mockResolvedValue({
      objectList: ["chat/2026/11/img.jpg"],
    } as Awaited<ReturnType<typeof clientAuthApi.getOssSts>>);
    upload.mockResolvedValue("https://cdn.example.com/chat/2026/11/img.jpg");

    await expect(
      uploadChatImage("token-1", "file:///cache/chat.jpg"),
    ).resolves.toBe("https://cdn.example.com/chat/2026/11/img.jpg");
    expect(getOssSts).toHaveBeenCalledWith("token-1", "111", [
      expect.stringMatching(/^chat-image-\d+\.jpg$/),
    ]);
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({ objectList: ["chat/2026/11/img.jpg"] }),
      "chat/2026/11/img.jpg",
      expect.objectContaining({ uri: "file:///cache/chat.jpg", mimeType: "image/jpeg" }),
    );
  });

  it("凭证缺少 objectList 时抛出可读错误", async () => {
    getOssSts.mockResolvedValue({} as Awaited<ReturnType<typeof clientAuthApi.getOssSts>>);

    await expect(
      uploadChatImage("token-1", "file:///cache/chat.jpg"),
    ).rejects.toThrow("上传凭证缺少文件路径");
  });

  it("GIF 保留 .gif 后缀与 MIME，便于重进会话后按 URL 识别动图", async () => {
    isGif.mockReturnValue(true);
    getOssSts.mockResolvedValue({
      objectList: ["chat/2026/11/img.gif"],
    } as Awaited<ReturnType<typeof clientAuthApi.getOssSts>>);
    upload.mockResolvedValue("https://cdn.example.com/chat/2026/11/img.gif");

    await expect(
      uploadChatImage("token-1", "file:///cache/anim.gif"),
    ).resolves.toBe("https://cdn.example.com/chat/2026/11/img.gif");
    expect(getOssSts).toHaveBeenCalledWith("token-1", "111", [
      expect.stringMatching(/^chat-image-\d+\.gif$/),
    ]);
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({ objectList: ["chat/2026/11/img.gif"] }),
      "chat/2026/11/img.gif",
      expect.objectContaining({ uri: "file:///cache/anim.gif", mimeType: "image/gif" }),
    );
    isGif.mockReturnValue(false);
  });
});
