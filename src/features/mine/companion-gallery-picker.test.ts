import { beforeEach, expect, it, vi } from "vitest";
import { launchImageLibraryAsync } from "expo-image-picker";
import { pickCompanionImageFiles } from "./companion-document-picker";
import { pickCompanionGalleryImages } from "./companion-gallery-picker";
import { selectCompanionImages } from "./companion-gallery-selection";
import { uploadCompanionMedia } from "./companion-upload";

const { platform, getOssSts, uploadClientObject } = vi.hoisted(() => ({
  platform: { OS: "android" },
  getOssSts: vi.fn(),
  uploadClientObject: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("expo-image-picker", () => ({ launchImageLibraryAsync: vi.fn() }));
vi.mock("./companion-document-picker", () => ({ pickCompanionImageFiles: vi.fn() }));
vi.mock("@/features/auth/client-auth.api", () => ({ clientAuthApi: { getOssSts } }));
vi.mock("@/features/auth/oss-upload", () => ({ uploadClientObject }));
vi.mock("expo-file-system", () => ({
  File: class {
    exists = true;
    size = 1024;
  },
}));

const originalName = "c0042827f42806483f424355a1491450.png";
const document = {
  name: originalName,
  uri: "file:///cache/DocumentPicker/51.png",
  mimeType: "image/png",
  size: 1024,
  lastModified: 0,
};

beforeEach(() => {
  vi.resetAllMocks();
  platform.OS = "android";
});

it("preserves the original document name through selection and upload even when the cache has an alias", async () => {
  vi.mocked(pickCompanionImageFiles).mockResolvedValue({ canceled: false, assets: [document] });
  const [asset] = await pickCompanionGalleryImages(9);
  expect(asset).toEqual({
    fileName: originalName,
    uri: document.uri,
    mimeType: document.mimeType,
    fileSize: document.size,
  });
  expect(launchImageLibraryAsync).not.toHaveBeenCalled();

  const { accepted, warnings } = selectCompanionImages([{ ...asset, fileSize: asset.fileSize! }]);
  expect(warnings).toEqual([]);
  const sts = { objectList: ["images/server-generated.png"] };
  getOssSts.mockResolvedValue(sts);
  uploadClientObject.mockResolvedValue("https://cdn.example/images/server-generated.png");
  await uploadCompanionMedia("token", accepted[0], "image");
  expect(getOssSts).toHaveBeenCalledWith("token", "107", [originalName]);
  expect(uploadClientObject).toHaveBeenCalledWith(sts, sts.objectList[0], {
    uri: document.uri,
    mimeType: document.mimeType,
  });
});

it("shows the complete original name for an oversized image rather than the cache filename", async () => {
  vi.mocked(pickCompanionImageFiles).mockResolvedValue({
    canceled: false,
    assets: [{ ...document, size: 2 * 1024 * 1024 + 1 }],
  });
  const assets = await pickCompanionGalleryImages(9);
  const result = selectCompanionImages(assets.map((asset) => ({ ...asset, fileSize: asset.fileSize! })));
  expect(result.accepted).toEqual([]);
  expect(result.warnings).toEqual([`${originalName}超过2MB，已跳过`]);
});

it("keeps each original name paired with its file and respects remaining image slots", async () => {
  const second = { ...document, name: "我的技能截图.png", uri: "file:///cache/52.png" };
  vi.mocked(pickCompanionImageFiles).mockResolvedValue({
    canceled: false,
    assets: [document, second, { ...document, name: "第三张.png", uri: "file:///cache/53.png" }],
  });
  const assets = await pickCompanionGalleryImages(2);
  expect(assets.map(({ fileName, uri }) => ({ fileName, uri }))).toEqual([
    { fileName: originalName, uri: document.uri },
    { fileName: second.name, uri: second.uri },
  ]);
});

it("cancellation adds no images and does not reopen another picker", async () => {
  vi.mocked(pickCompanionImageFiles).mockResolvedValue({ canceled: true, assets: null });
  await expect(pickCompanionGalleryImages(9)).resolves.toEqual([]);
  expect(launchImageLibraryAsync).not.toHaveBeenCalled();
});

it.each(["ios", "web"])("keeps the photo picker and selected asset metadata on %s", async (os) => {
  platform.OS = os;
  const image = { uri: "file:///photo.png", fileName: "原图.png", width: 100, height: 100 };
  vi.mocked(launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [image] });
  await expect(pickCompanionGalleryImages(2)).resolves.toEqual([image]);
  expect(pickCompanionImageFiles).not.toHaveBeenCalled();
});
