export const MAX_COMPANION_VOICE_SECONDS = 15;

const audioTypes: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
};

export function companionVoiceMimeType(file: {
  name: string;
  mimeType?: string;
  size?: number;
}) {
  if (file.size === 0) {
    throw new Error("音频文件为空，请重新选择");
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = file.mimeType?.split(";")[0].trim().toLowerCase() ?? "";
  if (mimeType.startsWith("audio/")) {
    return mimeType;
  }
  // 仅在系统未提供具体类型或返回 OGG 容器类型时，使用音频后缀兜底。
  const canInferFromExtension =
    !mimeType ||
    mimeType === "application/octet-stream" ||
    mimeType === "binary/octet-stream" ||
    mimeType === "application/ogg";
  if (canInferFromExtension && audioTypes[extension]) {
    return audioTypes[extension];
  }
  throw new Error("格式错误，只支持上传音频格式文件");
}

export function companionVoiceDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("无法读取语音时长，请重新选择音频文件");
  }
  // 先校验原始时长，避免超过上限的音频被四舍五入后放行。
  if (seconds > MAX_COMPANION_VOICE_SECONDS) {
    throw new Error(`语音时长不能超过${MAX_COMPANION_VOICE_SECONDS}秒`);
  }
  return Math.max(1, Math.round(seconds));
}
