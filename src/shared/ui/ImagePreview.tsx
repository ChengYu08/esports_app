import { ImageZoom } from "@likashefqet/react-native-image-zoom";
import { Image, type ImageErrorEventData } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { ImageErrorEvent as NativeImageErrorEvent } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { logger } from "@/core/logging/logger";
import { IMAGE_PREVIEW_ZOOM } from "@/features/mine/image-preview.zoom";
import { EmptyState } from "@/shared/ui/AsyncStates";

function sanitizeImageUri(uri: string) {
  if (uri.startsWith("data:")) return "data:<redacted>";
  return uri.split(/[?#]/, 1)[0];
}

function sanitizeImageError(error?: string) {
  return (error || "未提供错误详情")
    .replace(/(?:https?|file|content):\/\/[^\s"'<>]+/gi, (value) => sanitizeImageUri(value))
    .slice(0, 240);
}

function reportImageLoadFailure(stage: string, uri: string, error?: string) {
  logger.warn("Image preview failed to load image", {
    stage,
    uri: sanitizeImageUri(uri),
    error: sanitizeImageError(error),
  });
  return sanitizeImageError(error);
}

function PreviewImage({ uri, width, height }: { uri: string; width: number; height: number }) {
  const [zoomLoadFailed, setZoomLoadFailed] = useState(false);
  const [fallbackError, setFallbackError] = useState<string | null>(null);

  if (zoomLoadFailed) {
    return fallbackError ? (
      <View style={styles.imageError}>
        <Text style={styles.imageErrorText}>图片加载失败：{fallbackError}</Text>
      </View>
    ) : (
      <Image
        source={{ uri }}
        contentFit="contain"
        onError={(event: ImageErrorEventData) => setFallbackError(reportImageLoadFailure(
          "expo-image-fallback",
          uri,
          event.error,
        ))}
        style={{ width, height }}
      />
    );
  }

  return (
    <ImageZoom
      uri={uri}
      maxScale={IMAGE_PREVIEW_ZOOM.maxScale}
      doubleTapScale={IMAGE_PREVIEW_ZOOM.doubleTapScale}
      isDoubleTapEnabled
      isPinchEnabled
      onError={(event: NativeImageErrorEvent) => {
        reportImageLoadFailure("image-zoom", uri, event.nativeEvent.error);
        setZoomLoadFailed(true);
      }}
      style={{ width, height }}
    />
  );
}

export function ImagePreview({ images, index, onClose }: { images: string[]; index: number; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const visibleIndex = useRef(index);

  const prefetchNearbyImages = useCallback((centerIndex: number) => {
    const nearbyImages = images.slice(
      Math.max(0, centerIndex - 1),
      Math.min(images.length, centerIndex + 2),
    );
    if (nearbyImages.length > 0) {
      // 只预取到磁盘：原图进内存缓存会放大内存压力，返回聊天后易触发 GC 卡顿
      void Image.prefetch(nearbyImages, "disk");
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
      <StatusBar style="light" />
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
            <PreviewImage uri={item} width={width} height={height} />
          </View>
        )}
      />
      <Pressable accessibilityLabel="关闭图片预览" hitSlop={12} onPress={onClose} style={[styles.closeButton, { top: insets.top + 8 }]}>
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
  imageError: { flex: 1, alignItems: "center", justifyContent: "center" },
  imageErrorText: { color: "#fff", fontSize: 14 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
});
