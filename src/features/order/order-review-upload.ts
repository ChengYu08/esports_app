import { clientAuthApi } from "@/features/auth/client-auth.api";
import { uploadClientObject } from "@/features/auth/oss-upload";
import { preparePickedEvidenceImage } from "@/features/court/court-evidence-image";

/**
 * 上传评价图片：复用小法庭的选图预处理（HEIC 等格式自动转 JPEG），
 * 走通用 OSS 凭证 bizType 111，与 Web 端 ossUploadFile(file, { bizType: '111' }) 一致。
 */
export async function uploadReviewImage(token: string, uri: string): Promise<string> {
  const image = await preparePickedEvidenceImage(uri);
  const sts = await clientAuthApi.getOssSts(token, "111", [image.name]);
  const objectKey = sts.objectList?.[0];
  if (!objectKey) {
    throw new Error("上传凭证缺少文件路径，请重试");
  }
  return uploadClientObject(sts, objectKey, {
    uri: image.uri,
    mimeType: image.mimeType,
  });
}
