import { getDocumentAsync } from "expo-document-picker";

export function pickCompanionAudio() {
  return getDocumentAsync({
    type: ["audio/*", "application/ogg"],
    multiple: false,
    copyToCacheDirectory: true,
  });
}

export function pickCompanionImageFiles() {
  return getDocumentAsync({
    type: ["image/*"],
    multiple: true,
    copyToCacheDirectory: true,
    base64: false,
  });
}
