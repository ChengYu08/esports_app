import { Platform, type TextStyle } from "react-native";

export const PINGFANG_SC = "PingFang SC";

export const D_DIN_PRO = "D-DIN-PRO-400";

export const D_DIN_PRO_FONTS = {
  "D-DIN-PRO-300": require("../../../assets/fonts/D-DIN-PRO-300.ttf"),
  "D-DIN-PRO-400": require("../../../assets/fonts/D-DIN-PRO-400.ttf"),
  "D-DIN-PRO-500": require("../../../assets/fonts/D-DIN-PRO-500.ttf"),
  "D-DIN-PRO-600": require("../../../assets/fonts/D-DIN-PRO-600.ttf"),
  "D-DIN-PRO-700": require("../../../assets/fonts/D-DIN-PRO-700.ttf"),
  "D-DIN-PRO-800": require("../../../assets/fonts/D-DIN-PRO-800.ttf"),
  "D-DIN-PRO-900": require("../../../assets/fonts/D-DIN-PRO-900.ttf"),
};

export type DDinProWeight = 300 | 400 | 500 | 600 | 700 | 800 | 900;

export function getDDinProStyle(
  weight: DDinProWeight = 400,
): Pick<TextStyle, "fontFamily" | "fontWeight"> {
  return {
    fontFamily: `D-DIN-PRO-${weight}`,
    fontWeight: "normal",
  };
}

// 普通界面文字使用苹方，Android 回退到系统无衬线字体。
export const SYSTEM_FONT = Platform.select({
  ios: "PingFang SC",
  android: "sans-serif",
  default: '"PingFang SC", system-ui, sans-serif',
});
