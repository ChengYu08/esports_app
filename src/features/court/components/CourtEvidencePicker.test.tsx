import { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pickCompanionGalleryImages } from "@/features/mine/companion-gallery-picker";
import { useEvidenceImages } from "./CourtEvidencePicker";

vi.mock("@/features/court/complaint.styles", () => ({ complaintStyles: {} }));
vi.mock("@/features/mine/companion-gallery-picker", () => ({ pickCompanionGalleryImages: vi.fn() }));
vi.mock("expo-file-system", () => ({ File: class { size = 100; } }));
vi.mock("@/shared/ui/CachedImage", () => ({ CachedImage: "Image" }));
vi.mock("@esports/auth", () => ({ useAuthStore: { getState: () => ({ accessToken: "token" }) } }));
vi.mock("expo-router", () => ({ router: {} }));
vi.mock("react-native", () => ({ ActivityIndicator: "Spinner", Image: "Image", Pressable: "Button", Text: "Text", View: "View" }));
vi.mock("@/shared/ui/app-toast", () => ({ showToast: vi.fn(), toastDurations: { LONG: 1 } }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
let evidence: ReturnType<typeof useEvidenceImages>;
const checkAccount = vi.fn();

function Harness() {
  const state = useEvidenceImages("token", checkAccount);
  useEffect(() => {
    evidence = state;
  }, [state]);
  return null;
}

beforeEach(async () => {
  vi.resetAllMocks();
  await act(async () => { renderer = create(<Harness />); });
});

afterEach(async () => {
  await act(async () => { renderer.unmount(); });
});

describe("评审证据去重与重试", () => {
  it("分批重复选择同一图片时只保留一份，同名不同路径图片仍保留", async () => {
    const asset = { uri: "file:///a/image.png", fileName: "image.png", fileSize: 100, mimeType: "image/png" };
    vi.mocked(pickCompanionGalleryImages).mockResolvedValueOnce([asset, asset]);
    await act(async () => { await evidence.pickImages(); });
    vi.mocked(pickCompanionGalleryImages).mockResolvedValueOnce([asset, { ...asset, uri: "file:///b/image.png" }]);
    await act(async () => { await evidence.pickImages(); });
    expect(evidence.images.map((image) => image.uri)).toEqual([asset.uri, "file:///b/image.png"]);
  });

  it("重复 URI 上传一次，首次提交与重试返回相同且唯一的 Key", async () => {
    const image = { uri: "file:///image.png", name: "image.png" };
    await act(async () => { evidence.setImages([image, { ...image }]); });
    const upload = vi.fn().mockResolvedValueOnce("court/first.png").mockResolvedValueOnce("court/second.png");
    await act(async () => { expect(await evidence.uploadAll(upload)).toEqual(["court/first.png"]); });
    await act(async () => { expect(await evidence.uploadAll(upload)).toEqual(["court/first.png"]); });
    expect(upload).toHaveBeenCalledOnce();
  });

  it("后续图片上传失败后重试复用已成功的 Key，不产生重复证据", async () => {
    const first = { uri: "file:///first.png", name: "first.png" };
    const second = { uri: "file:///second.png", name: "second.png" };
    await act(async () => { evidence.setImages([first, { ...first }, second]); });
    const upload = vi.fn().mockResolvedValueOnce("court/first.png").mockRejectedValueOnce(new Error("网络失败")).mockResolvedValueOnce("court/second.png");
    await act(async () => { await expect(evidence.uploadAll(upload)).rejects.toThrow("网络失败"); });
    await act(async () => { expect(await evidence.uploadAll(upload)).toEqual(["court/first.png", "court/second.png"]); });
    expect(upload).toHaveBeenCalledTimes(3);
  });

  it("已有重复 Key 只提交一次，并复用同一 URI 已上传的证据", async () => {
    await act(async () => {
      evidence.setImages([
        { uri: "file:///image.png", name: "image.png" },
        { uri: "file:///image.png", name: "image.png", key: "court/image.png" },
        { uri: "https://cdn/image.png", name: "image.png", key: "court/image.png" },
      ]);
    });
    const upload = vi.fn();
    await act(async () => { expect(await evidence.uploadAll(upload)).toEqual(["court/image.png"]); });
    expect(upload).not.toHaveBeenCalled();
  });

  it.each(["", "   "])("上传返回空 Key %j 时阻止提交", async (key) => {
    await act(async () => { evidence.setImages([{ uri: "file:///image.png", name: "image.png" }]); });
    await act(async () => { await expect(evidence.uploadAll(vi.fn().mockResolvedValue(key))).rejects.toThrow("图片上传未返回有效凭证，请重试"); });
    expect(evidence.images[0].key).toBeUndefined();
  });
});
