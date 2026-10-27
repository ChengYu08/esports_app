import { Platform, StyleSheet } from "react-native";

// Figma uses PingFang SC. Android uses its system sans-serif fallback because
// this project does not bundle PingFang; do not substitute the brand display font.
const base = {
  fontFamily: Platform.select({
    ios: "PingFang SC",
    android: "sans-serif",
    default: '"PingFang SC", system-ui, sans-serif',
  }),
  includeFontPadding: false,
  letterSpacing: 0,
};

export const searchTypography = StyleSheet.create({
  regular14: { ...base, fontSize: 14, fontWeight: "400", lineHeight: 22 },
  medium14: { ...base, fontSize: 14, fontWeight: "500", lineHeight: 22 },
  semibold16: { ...base, fontSize: 16, fontWeight: "600", lineHeight: 22 },
  regular12: { ...base, fontSize: 12, fontWeight: "400", lineHeight: 18 },
  medium12: { ...base, fontSize: 12, fontWeight: "500", lineHeight: 18 },
  medium10: { ...base, fontSize: 10, fontWeight: "500", lineHeight: 14 },
  regular11: { ...base, fontSize: 11, fontWeight: "400", lineHeight: 16 },
  avatar: { ...base, fontSize: 18, fontWeight: "400", lineHeight: 24 },
});
