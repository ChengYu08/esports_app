import { describe, expect, it, vi, beforeEach } from "vitest";

import { uploadClientObject } from "@/features/auth/oss-upload";

import { uploadReviewImage } from "./order-review-upload";

const preparePickedEvidenceImage = vi.hoisted(() => vi.fn());
const getOssSts = vi.hoisted(() => vi.fn());

vi.mock("@/features/court/court-evidence-image", () => ({
  preparePickedEvidenceImage,
}));
vi.mock("@/features/auth/client-auth.api", () => ({
  clientAuthApi: { getOssSts },
}));
vi.mock("@/features/auth/oss-upload", () => ({
  uploadClientObject: vi.fn(),
}));

const sts = {
  accessKeyId: "id",
  accessKeySecret: "secret",
  securityToken: "token",
  bucketName: "bucket",
  endpoint: "https://oss.example.com",
  domain: "https://cdn.example.com",
  objectList: ["review/a.jpg"],
};

describe("评价图片上传", () => {
  beforeEach(() => {
    vi.mocked(uploadClientObject).mockReset();
    preparePickedEvidenceImage.mockReset();
    getOssSts.mockReset();
  });

  it("走通用 OSS 凭证 bizType 111 并返回上传后的 URL", async () => {
    preparePickedEvidenceImage.mockResolvedValue({
      uri: "file://cache/a.jpg",
      name: "a.jpg",
      mimeType: "image/jpeg",
    });
    getOssSts.mockResolvedValue(sts);
    vi.mocked(uploadClientObject).mockResolvedValue("https://cdn.example.com/review/a.jpg");

    const url = await uploadReviewImage("auth-token", "file://picked/heic.heic");

    expect(url).toBe("https://cdn.example.com/review/a.jpg");
    expect(getOssSts).toHaveBeenCalledWith("auth-token", "111", ["a.jpg"]);
    expect(uploadClientObject).toHaveBeenCalledWith(sts, "review/a.jpg", {
      uri: "file://cache/a.jpg",
      mimeType: "image/jpeg",
    });
  });

  it("凭证未返回文件路径时给出可读错误", async () => {
    preparePickedEvidenceImage.mockResolvedValue({
      uri: "file://cache/b.jpg",
      name: "b.jpg",
      mimeType: "image/jpeg",
    });
    getOssSts.mockResolvedValue({ ...sts, objectList: undefined });

    await expect(uploadReviewImage("auth-token", "file://picked/b.jpg")).rejects.toThrow(
      "上传凭证缺少文件路径，请重试",
    );
    expect(uploadClientObject).not.toHaveBeenCalled();
  });
});
