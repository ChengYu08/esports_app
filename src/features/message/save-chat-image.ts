import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { Platform } from "react-native";

import { detectImageFormat } from "@/shared/media-picker/image-compat";

const REMOTE_IMAGE = /^https?:\/\//i;

function remoteExtension(uri: string) {
  const match = uri.split(/[?#]/, 1)[0].match(/\.(gif|png|webp|jpe?g)$/i);
  return match ? match[1].toLowerCase() : "jpg";
}

async function downloadRemoteImage(uri: string) {
  const target = new File(
    Paths.cache,
    `chat-save-${Date.now()}.${remoteExtension(uri)}`,
  );
  const file = await File.downloadFileAsync(uri, target);
  return file.uri;
}

/** 融云下载到本地的文件统一按 .jpg 命名，GIF 等实际是原始字节，按魔数纠正后缀再入相册 */
async function normalizeLocalFile(uri: string) {
  try {
    const format = detectImageFormat(uri);
    const path = uri.split(/[?#]/, 1)[0].toLowerCase();
    if (!format || path.endsWith(`.${format.extension}`)) {
      return uri;
    }
    const target = new File(
      Paths.cache,
      `chat-save-${Date.now()}.${format.extension}`,
    );
    await new File(uri).copy(target);
    return target.uri;
  } catch {
    return uri;
  }
}

/** 把预览页当前图片写入系统相册；失败抛中文文案，由预览页统一 toast 提示 */
export async function saveChatImageToAlbum(uri: string): Promise<void> {
  // Android 10 起写入相册不需要存储权限，只有 iOS 和更老系统要申请（与二维码保存口径一致）
  if (Platform.OS !== "android" || Number(Platform.Version) < 30) {
    let granted = false;
    try {
      granted = (await MediaLibrary.requestPermissionsAsync(true)).granted;
    } catch {
      granted = false;
    }
    if (!granted) {
      throw new Error("请在系统设置中允许盼之电竞访问相册");
    }
  }
  try {
    const localUri = REMOTE_IMAGE.test(uri)
      ? await downloadRemoteImage(uri)
      : await normalizeLocalFile(uri);
    await MediaLibrary.Asset.create(localUri);
  } catch {
    // 下载/写相册的底层错误文案是英文且含义不定，统一成用户能看懂的提示
    throw new Error("保存失败，请稍后重试");
  }
}
