import { requireOptionalNativeModule } from "expo";
import type { DocumentPickerOptions, DocumentPickerResult } from "expo-document-picker";

type NativeDocumentPicker = {
  getDocumentAsync: (options: DocumentPickerOptions) => Promise<DocumentPickerResult>;
};

export async function pickCompanionAudio(): Promise<DocumentPickerResult> {
  // 按需查找：在较低版本的原生构建中直接导入该包会抛错。
  const picker = requireOptionalNativeModule<NativeDocumentPicker>("ExpoDocumentPicker");
  if (!picker || typeof picker.getDocumentAsync !== "function") {
    throw new Error("当前安装版本不支持音频文件选择，请更新App后重试");
  }
  return picker.getDocumentAsync({
    type: ["audio/*", "application/ogg"],
    multiple: false,
    copyToCacheDirectory: true,
    base64: false,
  });
}
