import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

const bgPublishDark = require("../../../../assets/images/bg_publish_dark.webp");

/** 加载前 / 边缘露底色，贴近 dark webp */
export const VOICE_ROOM_BG_BASE = "#0B0D17";

/**
 * 语聊房背景：复用发单页 dark webp 铺满屏幕
 */
export function VoiceRoomBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, styles.base]} />
      <Image
        source={bgPublishDark}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: VOICE_ROOM_BG_BASE },
});
