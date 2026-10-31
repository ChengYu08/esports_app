import { getDocumentAsync } from "expo-document-picker";

export function pickCompanionAudio() {
  return getDocumentAsync({
    type: ["audio/*", "application/ogg"],
    multiple: false,
    copyToCacheDirectory: true,
  });
}
