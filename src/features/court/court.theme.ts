import { Platform } from "react-native";

// Figma: 小法庭-全量, 559:133705. Android uses its system CJK fallback.
export const COURT_FONT_FAMILY = Platform.OS === "ios" ? "PingFang SC" : undefined;

export const COURT_COLORS = {
  text: "#0D0D0F",
  secondary: "#656566",
  muted: "#979799",
  footer: "#7F7F80",
  surface: "#FFFFFF",
  background: "#F5F6F7",
  plaintiff: "#3DA5FF",
  defendant: "#FE4267",
  selectedPlaintiff: "#1FA1FF",
  selectedDefendant: "#FE1F4C",
  favorite: "#FF943D",
} as const;
