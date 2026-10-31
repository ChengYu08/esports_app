import { beforeEach, expect, it, vi } from "vitest";
import { manipulateAsync } from "expo-image-manipulator";
import { pickCompanionGalleryImages } from "./companion-gallery-picker";
import { selectCompanionImages } from "./companion-gallery-selection";
import { uploadCompanionMedia } from "./companion-upload";

const { push, beginPick, getOssSts, uploadClientObject, files } = vi.hoisted(() => ({
  push: vi.fn(),
  beginPick: vi.fn(),
  getOssSts: vi.fn(),
  uploadClientObject: vi.fn(),
  files: new Map<string, Uint8Array>(),
}));

vi.mock("expo-router", () => ({ router: { push } }));
vi.mock("@/shared/media-picker/media-picker-session", () => ({
  beginMediaPick: beginPick,
}));
vi.mock("@/features/auth/client-auth.api", () => ({ clientAuthApi: { getOssSts } }));
vi.mock("@/features/auth/oss-upload", () => ({ uploadClientObject }));
vi.mock("expo-image-manipulator", () => ({
  manipulateAsync: vi.fn(),
  SaveFormat: { JPEG: "jpeg" },
}));
vi.mock("expo-file-system", () => ({
  FileMode: { ReadOnly: "r" },
  File: class {
    uri: string;
    constructor(uri: string) { this.uri = uri; }
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri)?.length ?? 0; }
    open() {
      return {
        readBytes: (length: number) => files.get(this.uri)!.slice(0, length),
        close: () => undefined,
      };
    }
  },
}));

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const heic = Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);

beforeEach(() => {
  vi.resetAllMocks();
  files.clear();
});

it("从相册页回传的本地路径推导文件名与 MIME，并尊重剩余可选张数", async () => {
  files.set("file:///cache/IMG_001.jpg", jpeg);
  files.set("file:///cache/IMG_002.png", png);
  beginPick.mockResolvedValueOnce([
    "file:///cache/IMG_001.jpg",
    "file:///cache/IMG_002.png",
  ]);
  const assets = await pickCompanionGalleryImages(1);
  expect(push).toHaveBeenCalledWith({
    pathname: "/media-picker",
    params: { max: "1" },
  });
  expect(assets).toEqual([
    {
      uri: "file:///cache/IMG_001.jpg",
      fileName: "IMG_001.jpg",
      fileSize: null,
      mimeType: "image/jpeg",
    },
  ]);
});

it("取消选择返回空数组", async () => {
  beginPick.mockResolvedValueOnce(null);
  await expect(pickCompanionGalleryImages(9)).resolves.toEqual([]);
  expect(push).toHaveBeenCalledTimes(1);
});

it("HEIC 照片转成 JPEG 后可正常通过选择校验", async () => {
  const convertedUri = "file:///cache/converted.jpg";
  files.set("file:///cache/IMG_0001.heic", heic);
  files.set(convertedUri, jpeg);
  beginPick.mockResolvedValueOnce(["file:///cache/IMG_0001.heic"]);
  vi.mocked(manipulateAsync).mockResolvedValue({ uri: convertedUri, width: 100, height: 100 });

  const [asset] = await pickCompanionGalleryImages(9);
  expect(asset).toEqual({
    uri: convertedUri,
    fileName: "converted.jpg",
    fileSize: null,
    mimeType: "image/jpeg",
  });
  const { accepted, warnings } = selectCompanionImages([{ ...asset, fileSize: 1024 }]);
  expect(warnings).toEqual([]);
  expect(accepted).toHaveLength(1);
});

it("接受 JPG/PNG/WebP 且上传保留派生文件名与 MIME", async () => {
  files.set("file:///cache/我的技能截图.png", png);
  beginPick.mockResolvedValueOnce(["file:///cache/我的技能截图.png"]);
  const [asset] = await pickCompanionGalleryImages(9);
  const { accepted, warnings } = selectCompanionImages([
    // 与页面一致：fileSize 为空时回退读本地文件大小
    { ...asset, fileSize: asset.fileSize ?? 1024 },
  ]);
  expect(warnings).toEqual([]);
  const sts = { objectList: ["images/server-generated.png"] };
  getOssSts.mockResolvedValue(sts);
  uploadClientObject.mockResolvedValue("https://cdn.example/images/server-generated.png");
  await uploadCompanionMedia("token", accepted[0], "image");
  expect(getOssSts).toHaveBeenCalledWith("token", "107", ["我的技能截图.png"]);
  expect(uploadClientObject).toHaveBeenCalledWith(sts, sts.objectList[0], {
    uri: asset.uri,
    mimeType: "image/png",
  });
});

it("gif 等不支持格式在选择校验时给出警告", async () => {
  files.set("file:///cache/动画.gif", Uint8Array.from(Buffer.from("GIF89a1234567")));
  beginPick.mockResolvedValueOnce(["file:///cache/动画.gif"]);
  const [asset] = await pickCompanionGalleryImages(9);
  const result = selectCompanionImages([{ ...asset, fileSize: asset.fileSize ?? 1024 }]);
  expect(result.accepted).toEqual([]);
  expect(result.warnings).toEqual(["动画.gif格式不支持，仅支持 JPG/PNG/WebP"]);
});
