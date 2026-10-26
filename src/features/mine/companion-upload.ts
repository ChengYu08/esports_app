import { clientAuthApi } from "@/features/auth/client-auth.api";
import { uploadClientObject } from "@/features/auth/oss-upload";
import { File } from "expo-file-system";

export async function uploadCompanionMedia(
  token: string,
  media: { uri: string; mimeType?: string | null; fileName?: string | null },
  kind: "image" | "voice",
) {
  const file = new File(media.uri);
  if (!file.exists) throw new Error("本地文件不存在，请重新选择");
  if (kind === "image" && file.size > 2 * 1024 * 1024)
    throw new Error("技能截图不能超过2MB");
  const suffix = media.uri.split("?")[0].split(".").pop()?.toLowerCase();
  const extension =
    suffix && /^[a-z0-9]{2,5}$/.test(suffix)
      ? suffix
      : kind === "voice"
        ? "m4a"
        : "jpg";
  const fileName = media.fileName || `${kind}-${Date.now()}.${extension}`;
  const sts = await clientAuthApi.getOssSts(
    token,
    kind === "voice" ? "111" : "107",
    [fileName],
  );
  const objectKey = sts.objectList?.[0];
  if (!objectKey) throw new Error("上传凭证缺少文件路径，请重试");
  return uploadClientObject(sts, objectKey, {
    uri: media.uri,
    mimeType: media.mimeType || (kind === "voice" ? "audio/mp4" : "image/jpeg"),
  });
}
