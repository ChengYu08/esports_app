import ImageViewing from "react-native-image-viewing";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useEffect } from "react";

import { parseImagePreviewParams } from "@/features/mine/image-preview.params";

export default function ImagePreviewScreen() {
  const params = useLocalSearchParams<{ images?: string | string[]; index?: string | string[] }>();
  const { images, index } = parseImagePreviewParams(params);

  useEffect(() => {
    if (images.length === 0) router.back();
  }, [images.length]);

  if (images.length === 0) {
    return <View style={styles.empty} />;
  }

  return (
    <View style={styles.screen}>
      <ImageViewing
        images={images.map((uri) => ({ uri }))}
        imageIndex={index}
        visible
        onRequestClose={() => router.back()}
        presentationStyle="overFullScreen"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  empty: { flex: 1, backgroundColor: "#000" },
});
