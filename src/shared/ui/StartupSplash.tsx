import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

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
    SplashScreen.hide();
    // Start counting after rendering the image and dismissing the native screen.
    const timer = setTimeout(
      onFinished,
      imageState === "displayed" ? MIN_DISPLAY_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [imageState, onFinished]);

  return (
    <View style={styles.screen}>
      <Image
        accessibilityIgnoresInvertColors
        contentFit="cover"
        onDisplay={() => setImageState("displayed")}
        onError={() => setImageState("failed")}
        source={splashImage}
        style={styles.image}
        transition={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#2A1013" },
  image: { flex: 1, width: "100%" },
});
