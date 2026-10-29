import { Image } from "expo-image";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

const background = require("../../../../assets/home/h_background.png");

type HomeBackgroundProps = {
  style?: StyleProp<ViewStyle>;
};

/** 使用设计稿完整切图，保留渐变方向和柔化效果。 */
export function HomeBackground({ style }: HomeBackgroundProps) {
  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      <Image source={background} contentFit="fill" style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    aspectRatio: 375 / 276,
    overflow: "hidden",
  },
});
