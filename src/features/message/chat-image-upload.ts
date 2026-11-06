import { clientAuthApi } from "@/features/auth/client-auth.api";
import { uploadClientObject } from "@/features/auth/oss-upload";

/**
 * 聊天图片先上传自家 OSS 再发送：融云私有存储的媒体 URL 直接访问会 401，
 * PC 端同样是自己上传后把公网地址放进 RC:ImgMsg 的 imageUri，这里与 Web 端对齐。
 */
export async function uploadChatImage(token: string, uri: string): Promise<string> {
  const name = `chat-image-${Date.now()}.jpg`;
  const sts = await clientAuthApi.getOssSts(token, "111", [name]);
  const objectKey = sts.objectList?.[0];
  if (!objectKey) {
    throw new Error("上传凭证缺少文件路径，请重试");
  }
  return uploadClientObject(sts, objectKey, {
    uri,
    mimeType: "image/jpeg",
  });
}
