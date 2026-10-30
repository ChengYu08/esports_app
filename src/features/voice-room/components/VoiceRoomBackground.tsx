import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Defs,
  Ellipse,
  RadialGradient,
  Stop,
} from "react-native-svg";

export const VOICE_ROOM_BG_GRADIENT = ["#0C0C2E", "#120D2B"] as const;
export const VOICE_ROOM_BG_BASE = "#0C0C2E";

/**
 * 语聊房背景：对齐 Figma「dark bg」
 * 纵向深紫渐变 + 右上冷蓝漫光 + 右下暗玫红漫光 + 中央柔和压暗
 * 漫光固定在 375x812 设计稿坐标系，preserveAspectRatio="none" 拉伸铺满屏幕
 */
export function VoiceRoomBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={VOICE_ROOM_BG_GRADIENT}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox="0 0 375 812"
        preserveAspectRatio="none"
      >
        <Defs>
          <RadialGradient
            id="coolBlue"
            cx="340"
            cy="115"
            rx="200"
            ry="245"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="#465683" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#465683" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id="rose"
            cx="338.5"
            cy="740"
            rx="221.5"
            ry="195"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="#713749" stopOpacity="0.13" />
            <Stop offset="1" stopColor="#713749" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx="340" cy="115" rx="200" ry="245" fill="url(#coolBlue)" />
        <Ellipse cx="338.5" cy="740" rx="221.5" ry="195" fill="url(#rose)" />
      </Svg>
      <LinearGradient
        colors={[
          "rgba(11,13,21,0.05)",
          "rgba(11,13,21,0.18)",
          "rgba(11,13,21,0.02)",
        ]}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
