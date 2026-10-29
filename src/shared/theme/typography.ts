import { Platform } from "react-native";

// 设计稿正文字体为系统字体（iOS 为 PingFang SC）。项目仅有单一字重的
// DouyinSans.ttf，设置 fontWeight 会被系统伪加粗；置为 undefined 全局
// 回落到系统字体，各处 fontFamily: DOUYIN_SANS 无需改动，换回自定义字体时只改这里。
export const DOUYIN_SANS = undefined;
export const PINGFANG_SC = "PingFang SC";

// 普通界面文字使用苹方，Android 回退到系统无衬线字体。
export const SYSTEM_FONT = Platform.select({
  ios: "PingFang SC",
  android: "sans-serif",
  default: '"PingFang SC", system-ui, sans-serif',
});
