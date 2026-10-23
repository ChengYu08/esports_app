import { CachedImage } from "@/shared/ui/CachedImage";
import { useState } from "react";
import { StyleSheet } from "react-native";

const defaultAvatar = require("../../../../assets/coms/avatar_default.webp");

export function CourtAvatar({ uri, size = 30 }: { uri?: string; size?: number }) {
  const [failedUri, setFailedUri] = useState<string>();
  const trimmedUri = uri?.trim();
  const avatarUri = trimmedUri?.startsWith("//") ? `https:${trimmedUri}` : trimmedUri;

  return (
    <CachedImage
      source={avatarUri && avatarUri !== failedUri ? { uri: avatarUri } : defaultAvatar}
      placeholder={defaultAvatar}
      contentFit="cover"
      placeholderContentFit="cover"
      recyclingKey={avatarUri || "default"}
      onError={() => setFailedUri(avatarUri)}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    />
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: "#EEEEEE",
    borderColor: "rgba(255,255,255,0.6)",
    borderWidth: 0.5,
    flexShrink: 0,
  },
});
