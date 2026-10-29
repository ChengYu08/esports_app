import { beforeEach, expect, it, vi } from "vitest";

import { requireOptionalNativeModule } from "expo";
import { pickCompanionAudio, pickCompanionImageFiles } from "./companion-document-picker.native";

vi.mock("expo", () => ({ requireOptionalNativeModule: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

it("older native builds get an actionable error rather than importing a missing module", async () => {
  vi.mocked(requireOptionalNativeModule).mockReturnValue(null);
  await expect(pickCompanionAudio()).rejects.toThrow("请更新App后重试");
  expect(requireOptionalNativeModule).toHaveBeenCalledWith("ExpoDocumentPicker");
});

it("guards an incompatible native module without calling an undefined method", async () => {
  vi.mocked(requireOptionalNativeModule).mockReturnValue({});
  await expect(pickCompanionAudio()).rejects.toThrow("请更新App后重试");
});

it("opens the native audio picker and preserves cancellation", async () => {
  const getDocumentAsync = vi.fn().mockResolvedValue({ canceled: true, assets: null });
  vi.mocked(requireOptionalNativeModule).mockReturnValue({ getDocumentAsync });
  await expect(pickCompanionAudio()).resolves.toEqual({ canceled: true, assets: null });
  expect(getDocumentAsync).toHaveBeenCalledWith({ type: ["audio/*", "application/ogg"], multiple: false, copyToCacheDirectory: true, base64: false });
});

it("opens image documents with the original name separate from the cached URI", async () => {
  const result = {
    canceled: false,
    assets: [{
      name: "c0042827f42806483f424355a1491450.png",
      uri: "file:///cache/DocumentPicker/51.png",
      mimeType: "image/png",
      size: 1024,
      lastModified: 0,
    }],
  };
  const getDocumentAsync = vi.fn().mockResolvedValue(result);
  vi.mocked(requireOptionalNativeModule).mockReturnValue({ getDocumentAsync });

  await expect(pickCompanionImageFiles()).resolves.toEqual(result);
  expect(getDocumentAsync).toHaveBeenCalledWith({
    type: ["image/*"],
    multiple: true,
    copyToCacheDirectory: true,
    base64: false,
  });
});

it("reports unsupported image selection instead of falling back to an alias", async () => {
  vi.mocked(requireOptionalNativeModule).mockReturnValue(null);
  await expect(pickCompanionImageFiles()).rejects.toThrow(
    "当前安装版本不支持图片文件选择，请更新App后重试",
  );
});
