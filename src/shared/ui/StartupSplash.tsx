import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

const splashImage = require("../../../assets/images/splash-screen.png");
const MIN_DISPLAY_MS = 1000;
const IMAGE_TIMEOUT_MS = 8000;

type Props = {
  onFinished: () => void;
};

export function StartupSplash({ onFinished }: Props) {
  const [imageState, setImageState] = useState<
    "loading" | "displayed" | "failed"
  >("loading");

  useEffect(() => {
    if (imageState !== "loading") return;
    // An image error or missing native callback must not trap users at launch.
    const timer = setTimeout(() => setImageState("failed"), IMAGE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [imageState]);

  useEffect(() => {
    if (imageState === "loading") return;
    // 原生层 windowBackground 已铺同一张图，这里等图片绘制完成后计最小展示时长。
    const timer = setTimeout(
      onFinished,
      imageState === "displayed" ? MIN_DISPLAY_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [imageState, onFinished]);

  return (
    <SafeAreaProvider style={styles.provider}>
      <View style={styles.screen}>
        <Image
          accessibilityIgnoresInvertColors
          contentFit="fill"
          onDisplay={() => setImageState("displayed")}
          onError={() => setImageState("failed")}
          source={splashImage}
          style={styles.image}
          transition={0}
        />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Android edge-to-edge insets are measured from this provider; without it the
  // first frame falls back to a window that excludes the system bars, so the
  // image renders "fill"-fitted into a smaller area and leaves letterboxes.
  // contentFit 用 fill：与原生 windowBackground 的 bitmap gravity fill 几何完全
  // 一致（拉伸铺满窗口），两层重叠时零位移，避免 cover 裁剪导致的启动图抖动。
  // 透明底：图片解码完成前由原生 windowBackground 的同图透出，避免图→白→图闪烁。
  provider: {
    flex: 1,
  },
  screen: { flex: 1 },
  image: { flex: 1, width: "100%" },
});
