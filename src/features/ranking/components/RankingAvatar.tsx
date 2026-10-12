import { Image } from "expo-image";
import { useState } from "react";

const defaultAvatar = require("../../../../assets/coms/avatar_default.webp");

export function RankingAvatar({
  uri,
  size = 42,
}: {
  uri?: string;
  size?: number;
}) {
  const [failedUri, setFailedUri] = useState<string>();
  return (
    <Image
      source={uri && uri !== failedUri ? { uri } : defaultAvatar}
      placeholder={defaultAvatar}
      contentFit="cover"
      placeholderContentFit="cover"
      recyclingKey={uri || "default"}
      onError={() => setFailedUri(uri)}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#F3F3F5",
      }}
    />
  );
}
