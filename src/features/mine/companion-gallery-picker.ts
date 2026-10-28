import { launchImageLibraryAsync, type ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";
import { pickCompanionImageFiles } from "./companion-document-picker";

export type CompanionGalleryImage = Pick<
  ImagePickerAsset,
  "uri" | "fileName" | "fileSize" | "mimeType"
>;

export async function pickCompanionGalleryImages(
  selectionLimit: number,
): Promise<CompanionGalleryImage[]> {
  if (Platform.OS === "android") {
    // 使用 ACTION_OPEN_DOCUMENT 读取原文件记录；照片选择器的 fileName 可能是系统别名。
    const result = await pickCompanionImageFiles();
    if (result.canceled) {
      return [];
    }
    return result.assets.slice(0, selectionLimit).map((asset) => ({
      uri: asset.uri,
      // 缓存路径可能已被重命名，提示和上传始终保留原始 name。
      fileName: asset.name,
      fileSize: asset.size,
      mimeType: asset.mimeType,
    }));
  }

  const result = await launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit,
    quality: 0.85,
  });
  if (result.canceled) {
    return [];
  }
  return result.assets.slice(0, selectionLimit);
}
