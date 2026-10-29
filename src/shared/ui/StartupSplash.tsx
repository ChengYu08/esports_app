import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
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
    SplashScreen.hide();
    // Start counting after the image has painted AND the native splash is gone.
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
          contentFit="cover"
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
  // image renders "cover"-fitted into a smaller area and leaves letterboxes.
  provider: {
    flex: 1,
    backgroundColor: "#2A1013",
  },
  screen: { flex: 1, backgroundColor: "#2A1013" },
  image: { flex: 1, width: "100%" },
});
