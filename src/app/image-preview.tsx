import { ImageZoom } from "@likashefqet/react-native-image-zoom";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
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
  const visibleIndex = useRef(index);

  useEffect(() => {
    if (images.length === 0) router.back();
  }, [images]);

  const prefetchNearbyImages = useCallback((centerIndex: number) => {
    const nearbyImages = images.slice(
      Math.max(0, centerIndex - 1),
      Math.min(images.length, centerIndex + 2),
    );
    if (nearbyImages.length > 0) {
      void Image.prefetch(nearbyImages, "memory-disk");
    }
  }, [images]);

  useEffect(() => {
    visibleIndex.current = index;
    prefetchNearbyImages(index);
  }, [index, prefetchNearbyImages]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
      const clampedIndex = Math.max(0, Math.min(nextIndex, images.length - 1));
      if (clampedIndex === visibleIndex.current) return;
      visibleIndex.current = clampedIndex;
      prefetchNearbyImages(clampedIndex);
    },
    [images.length, prefetchNearbyImages, width],
  );

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
        onMomentumScrollEnd={handleMomentumScrollEnd}
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
