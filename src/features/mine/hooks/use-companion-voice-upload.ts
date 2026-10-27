import { createAudioPlayer } from "expo-audio";
import { useEffect, useRef, useState } from "react";
import Toast from "react-native-root-toast";
import { companionManagementApi as api } from "../api/companion-management.api";
import { pickCompanionAudio } from "../companion-document-picker";
import { uploadCompanionMedia } from "../companion-upload";
import {
  companionVoiceDuration,
  companionVoiceMimeType,
} from "../companion-voice-file";
import type { useManagedGame } from "./use-companion-management";

function showUploadMessage(message: string) {
  Toast.show(message, {
    duration: Toast.durations.SHORT,
    position: Toast.positions.CENTER,
    backgroundColor: "#000",
    textColor: "#FFF",
    opacity: 0.8,
    shadow: false,
    keyboardAvoiding: false,
    containerStyle: {
      width: 200,
      maxWidth: "85%",
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    textStyle: { fontSize: 14, lineHeight: 22, textAlign: "center" },
  });
}

/** 仅加载元数据：该播放器不播放音频，也不会请求麦克风权限。 */
export async function readCompanionVoiceDuration(uri: string) {
  const player = createAudioPlayer(null);
  let subscription: { remove: () => void } | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<number>((resolve, reject) => {
      const check = () => {
        if (!player.isLoaded) return;
        try {
          resolve(companionVoiceDuration(player.duration));
        } catch (error) {
          reject(error);
        }
      };
      subscription = player.addListener("playbackStatusUpdate", check);
      timeout = setTimeout(
        () => reject(new Error("无法读取语音时长，请重新选择音频文件")),
        15_000,
      );
      player.replace(uri);
      check();
    });
  } finally {
    clearTimeout(timeout);
    subscription?.remove();
    player.remove();
  }
}

export function useCompanionVoiceUpload(
  managed: ReturnType<typeof useManagedGame>,
  stopPlayback: () => void,
) {
  const [uploading, setUploading] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const upload = async () => {
    if (!managed.enabled || busy.current) return;
    busy.current = true;
    setUploading(true);
    stopPlayback();
    try {
      const result = await pickCompanionAudio();
      if (result.canceled || !mounted.current) return;
      const file = result.assets[0];
      if (!file) return;
      managed.assertCurrentAccount();
      const mimeType = companionVoiceMimeType(file);
      const duration = await readCompanionVoiceDuration(file.uri);
      if (!mounted.current) return;
      managed.assertCurrentAccount();
      const voiceUrl = await uploadCompanionMedia(
        managed.token,
        {
          uri: file.uri,
          fileName: file.name,
          mimeType,
        },
        "voice",
      );
      managed.assertCurrentAccount();
      await api.updateVoice(managed.context, managed.token, voiceUrl, duration);
      await managed.invalidate();
      if (mounted.current) showUploadMessage("上传成功");
    } catch (error) {
      if (!mounted.current) return;
      const message = error instanceof Error ? error.message : "请稍后重试";
      showUploadMessage(
        /native module.*(ExpoDocumentPicker|DocumentPicker)/i.test(message)
          ? "当前安装版本不支持音频文件选择，请更新App后重试"
          : message,
      );
    } finally {
      busy.current = false;
      if (mounted.current) setUploading(false);
    }
  };
  return { uploading, upload };
}
