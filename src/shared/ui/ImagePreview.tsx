import { ImageZoom } from "@likashefqet/react-native-image-zoom";
import { Image, type ImageErrorEventData } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
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

function PreviewImage({
  uri,
  width,
  height,
  nearby,
  resolveUri,
}: {
  uri: string;
  width: number;
  height: number;
  /** 当前页及左右相邻页才去解析远端地址，避免一进预览就批量下载 */
  nearby: boolean;
  resolveUri?: (uri: string) => Promise<string>;
}) {
  const needsResolve = Boolean(resolveUri) && /^https?:/i.test(uri);
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [zoomLoadFailed, setZoomLoadFailed] = useState(false);
  const [fallbackError, setFallbackError] = useState<string | null>(null);

  useEffect(() => {
    if (!needsResolve || !nearby || !resolveUri) {
      return;
    }
    let cancelled = false;
    resolveUri(uri).then(
      (next) => {
        if (!cancelled) setResolvedUri(next);
      },
      (error: unknown) => {
        if (!cancelled) setResolveError(error instanceof Error ? error.message : "图片下载失败");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [nearby, needsResolve, resolveUri, uri]);

  if (resolveError) {
    return (
      <View style={styles.imageError}>
        <Text style={styles.imageErrorText}>图片加载失败：{resolveError}</Text>
      </View>
    );
  }

  const source = needsResolve ? resolvedUri : uri;
  if (!source) {
    return (
      <View style={[styles.imageLoading, { width, height }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (zoomLoadFailed) {
    return fallbackError ? (
      <View style={styles.imageError}>
        <Text style={styles.imageErrorText}>图片加载失败：{fallbackError}</Text>
      </View>
    ) : (
      <Image
        source={{ uri: source }}
        contentFit="contain"
        onError={(event: ImageErrorEventData) => setFallbackError(reportImageLoadFailure(
          "expo-image-fallback",
          source,
          event.error,
        ))}
        style={{ width, height }}
      />
    );
  }

  return (
    <ImageZoom
      uri={source}
      maxScale={IMAGE_PREVIEW_ZOOM.maxScale}
      doubleTapScale={IMAGE_PREVIEW_ZOOM.doubleTapScale}
      isDoubleTapEnabled
      isPinchEnabled
      onError={(event: NativeImageErrorEvent) => {
        reportImageLoadFailure("image-zoom", source, event.nativeEvent.error);
        setZoomLoadFailed(true);
      }}
      style={{ width, height }}
    />
  );
}

function FitWidthImage({ uri, width }: { uri: string; width: number }) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <View style={[styles.imageError, { height: width }]}><Text style={styles.imageErrorText}>图片加载失败</Text></View>;
  }

  return (
    <Image
      source={{ uri }}
      contentFit="contain"
      cachePolicy="disk"
      onLoad={({ source }) => {
        if (source.width > 0 && source.height > 0) {
          setAspectRatio(source.width / source.height);
        }
      }}
      onError={(event) => {
        reportImageLoadFailure("fit-width", uri, event.error);
        setFailed(true);
      }}
      style={{ width, height: aspectRatio ? width / aspectRatio : width }}
    />
  );
}

export function ImagePreview({ images, index, onClose, mode }: { images: string[]; index: number; onClose: () => void; mode?: "fit-width" }) {
type ImagePreviewProps = {
  images: string[];
  index: number;
  onClose: () => void;
  mode?: "fit-width";
  /** 远端地址需要鉴权时提供：滑到该页时解析成可访问的地址（例如先经 SDK 下载到本地） */
  resolveUri?: (uri: string) => Promise<string>;
};

export function ImagePreview({ images, index, onClose, mode, resolveUri }: ImagePreviewProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const visibleIndex = useRef(index);
  const [activeIndex, setActiveIndex] = useState(index);

  const prefetchNearbyImages = useCallback((centerIndex: number) => {
    // 需要鉴权的地址直接请求会失败，交给 resolveUri 按需下载
    if (resolveUri) return;
    const nearbyImages = images.slice(
      Math.max(0, centerIndex - 1),
      Math.min(images.length, centerIndex + 2),
    );
    if (nearbyImages.length > 0) {
      // 只预取到磁盘：原图进内存缓存会放大内存压力，返回聊天后易触发 GC 卡顿
      void Image.prefetch(nearbyImages, "disk");
    }
  }, [images, resolveUri]);

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
      setActiveIndex(clampedIndex);
      prefetchNearbyImages(clampedIndex);
    },
    [images.length, prefetchNearbyImages, width],
  );

  if (images.length === 0) {
    return <View style={styles.empty}><EmptyState message="暂无图片" /></View>;
  }

  if (mode === "fit-width") {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <FitWidthImage key={images[index]} uri={images[index]} width={width} />
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="关闭图片预览" hitSlop={12} onPress={onClose} style={[styles.closeButton, { top: insets.top + 8 }]}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
    );
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
        renderItem={({ item, index: itemIndex }) => (
          <View style={[styles.page, { width, height }]}>
            <PreviewImage
              uri={item}
              width={width}
              height={height}
              nearby={Math.abs(itemIndex - activeIndex) <= 1}
              resolveUri={resolveUri}
            />
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
  imageLoading: { alignItems: "center", justifyContent: "center" },
  imageError: { flex: 1, alignItems: "center", justifyContent: "center" },
  imageErrorText: { color: "#fff", fontSize: 14 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
});
