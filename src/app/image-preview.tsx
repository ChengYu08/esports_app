import { ImageZoom } from "@likashefqet/react-native-image-zoom";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { parseImagePreviewParams } from "@/features/mine/image-preview.params";
import { IMAGE_PREVIEW_ZOOM } from "@/features/mine/image-preview.zoom";
import { EmptyState } from "@/shared/ui/AsyncStates";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function ImagePreviewScreen() {
  const params = useLocalSearchParams<{ images?: string | string[]; index?: string | string[] }>();
  const { images, index } = parseImagePreviewParams(params);

  useEffect(() => {
    if (images.length === 0) router.back();
  }, [images.length]);

  if (images.length === 0) {
    return <View style={styles.empty}><EmptyState message="暂无图片" /></View>;
  }

  return (
    <GestureHandlerRootView style={styles.screen}>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={index}
        keyExtractor={(uri, itemIndex) => `${uri}-${itemIndex}`}
        getItemLayout={(_, itemIndex) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * itemIndex,
          index: itemIndex,
        })}
        renderItem={({ item }) => (
          <View style={styles.page}>
            <ImageZoom
              uri={item}
              maxScale={IMAGE_PREVIEW_ZOOM.maxScale}
              doubleTapScale={IMAGE_PREVIEW_ZOOM.doubleTapScale}
              isDoubleTapEnabled
              isPinchEnabled
              style={styles.zoomImage}
            />
          </View>
        )}
      />
      <Pressable accessibilityLabel="关闭图片预览" hitSlop={12} onPress={() => router.back()} style={styles.closeButton}>
        <Text style={styles.closeText}>×</Text>
      </Pressable>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  zoomImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  closeButton: {
    position: "absolute",
    top: 56,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  closeText: { color: "#fff", fontSize: 32, fontWeight: "300", lineHeight: 36 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
});
