export const MAX_COMPANION_VOICE_SECONDS = 60;

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
  if (file.size === 0) throw new Error("音频文件为空，请重新选择");
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.mimeType?.startsWith("audio/")) return file.mimeType;
  if (audioTypes[extension]) return audioTypes[extension];
  throw new Error("格式错误，只支持上传音频格式文件");
}

export function companionVoiceDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0)
    throw new Error("无法读取语音时长，请重新选择音频文件");
  const duration = Math.max(1, Math.round(seconds));
  if (duration > MAX_COMPANION_VOICE_SECONDS)
    throw new Error(`语音时长不能超过${MAX_COMPANION_VOICE_SECONDS}秒`);
  return duration;
}
