import { describe, expect, it, vi } from "vitest";

import { clientAuthApi } from "@/features/auth/client-auth.api";
import { uploadClientObject } from "@/features/auth/oss-upload";

import { uploadChatImage } from "./chat-image-upload";

vi.mock("@/features/auth/client-auth.api", () => ({
  clientAuthApi: { getOssSts: vi.fn() },
}));
vi.mock("@/features/auth/oss-upload", () => ({
  uploadClientObject: vi.fn(),
}));

const getOssSts = vi.mocked(clientAuthApi.getOssSts);
const upload = vi.mocked(uploadClientObject);

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
});
