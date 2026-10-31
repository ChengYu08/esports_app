import { beforeEach, expect, it, vi } from "vitest";

import { requireOptionalNativeModule } from "expo";
import { pickCompanionAudio } from "./companion-document-picker.native";

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
