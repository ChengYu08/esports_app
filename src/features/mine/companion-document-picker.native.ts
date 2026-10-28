import { requireOptionalNativeModule } from "expo";
import type { DocumentPickerOptions, DocumentPickerResult } from "expo-document-picker";

type NativeDocumentPicker = {
  getDocumentAsync: (options: DocumentPickerOptions) => Promise<DocumentPickerResult>;
};

function getNativePicker(mediaName: "音频" | "图片") {
  // 按需查找：在较低版本的原生构建中直接导入该包会抛错。
  const picker = requireOptionalNativeModule<NativeDocumentPicker>("ExpoDocumentPicker");
  if (!picker || typeof picker.getDocumentAsync !== "function") {
    throw new Error(`当前安装版本不支持${mediaName}文件选择，请更新App后重试`);
  }
  return picker;
}

export async function pickCompanionAudio(): Promise<DocumentPickerResult> {
  return getNativePicker("音频").getDocumentAsync({
    type: ["audio/*", "application/ogg"],
    multiple: false,
    copyToCacheDirectory: true,
    base64: false,
  });
}

export async function pickCompanionImageFiles(): Promise<DocumentPickerResult> {
  return getNativePicker("图片").getDocumentAsync({
    type: ["image/*"],
    multiple: true,
    copyToCacheDirectory: true,
    base64: false,
  });
}
