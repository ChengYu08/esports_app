import { ImageZoom } from "@likashefqet/react-native-image-zoom";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { parseImagePreviewParams } from "@/features/mine/image-preview.params";
import { IMAGE_PREVIEW_ZOOM } from "@/features/mine/image-preview.zoom";
import { EmptyState } from "@/shared/ui/AsyncStates";

export default function ImagePreviewScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ images?: string | string[]; index?: string | string[] }>();
  const rawImages = params.images;
  const rawIndex = params.index;
  const { images, index } = useMemo(
    () => parseImagePreviewParams({ images: rawImages, index: rawIndex }),
    [rawImages, rawIndex],
  );

  useEffect(() => {
    if (images.length === 0) router.back();
    else void Image.prefetch(images, "memory-disk");
  }, [images]);

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
          length: width,
          offset: width * itemIndex,
          index: itemIndex,
        })}
        renderItem={({ item }) => (
          <View style={[styles.page, { width, height }]}>
            <ImageZoom
              uri={item}
              maxScale={IMAGE_PREVIEW_ZOOM.maxScale}
              doubleTapScale={IMAGE_PREVIEW_ZOOM.doubleTapScale}
              isDoubleTapEnabled
              isPinchEnabled
              style={{ width, height }}
            />
          </View>
        )}
      />
      <Pressable accessibilityLabel="关闭图片预览" hitSlop={12} onPress={() => router.back()} style={[styles.closeButton, { top: insets.top + 8 }]}>
        <Text style={styles.closeText}>×</Text>
      </Pressable>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  page: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  closeButton: {
    position: "absolute",
    top: 8,
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
