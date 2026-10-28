import { Platform } from "react-native";

export const DOUYIN_SANS = 'DouyinSans';

// 普通界面文字使用苹方，Android 回退到系统无衬线字体。
export const SYSTEM_FONT = Platform.select({
  ios: "PingFang SC",
  android: "sans-serif",
  default: '"PingFang SC", system-ui, sans-serif',
});

