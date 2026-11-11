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
import { showToast } from "@/shared/ui/app-toast";
import { EmptyState } from "@/shared/ui/AsyncStates";

// 加载中只做很浅的提示，避免抢画面
const LOADING_HINT_COLOR = "rgba(255,255,255,0.45)";

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
  pageIndex,
  width,
  height,
  nearby,
  resolveAt,
}: {
  uri: string;
  pageIndex: number;
  width: number;
  height: number;
  /** 当前页及左右相邻页才去解析，避免一进预览就批量下载 */
  nearby: boolean;
  /** 需要鉴权的图片（融云远端地址直连 401）按页解析成可访问地址；不提供时直接加载 uri */
  resolveAt?: (index: number) => Promise<string>;
}) {
  const needsResolve = Boolean(resolveAt);
  const [resolvedSource, setResolvedSource] = useState<string | null>(null);
  const [resolveFailed, setResolveFailed] = useState(false);
  // 失败态按"出错的地址"记录，页面复用到新地址时自动复位，省掉同步 prop 的 effect
  const [zoomFailedUri, setZoomFailedUri] = useState<string | null>(null);
  const [loadFailedUri, setLoadFailedUri] = useState<string | null>(null);
  // 用"已加载完成的地址"比较，避免重试/复位把已显示的图片重新盖成加载中
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  // 递增的请求号：滑走或重试时作废上一次还在进行的解析
  const requestRef = useRef(0);
  const resolvedRef = useRef(false);

  const startResolve = useCallback((force = false) => {
    if (!resolveAt) {
      return;
    }
    if (!force && resolvedRef.current) {
      return;
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setResolvedSource(null);
    setResolveFailed(false);
    setZoomFailedUri(null);
    setLoadFailedUri(null);
    resolveAt(pageIndex).then(
      (next) => {
        if (requestRef.current !== requestId) {
          return;
        }
        resolvedRef.current = true;
        setResolvedSource(next);
      },
      (error: unknown) => {
        if (requestRef.current !== requestId) {
          return;
        }
        reportImageLoadFailure("resolve", uri, error instanceof Error ? error.message : undefined);
        setResolveFailed(true);
      },
    );
  }, [pageIndex, resolveAt, uri]);

  // 鉴权图片只在相邻页触发解析，滑到位后再下载
  useEffect(() => {
    if (!needsResolve || !nearby) {
      return;
    }
    startResolve();
    return () => {
      requestRef.current += 1;
    };
  }, [nearby, needsResolve, startResolve]);

  const source = needsResolve ? resolvedSource : uri;
  const zoomLoadFailed = source !== null && zoomFailedUri === source;
  const loadFailed = source !== null && loadFailedUri === source;

  const retry = useCallback(() => {
    if (needsResolve) {
      resolvedRef.current = false;
      startResolve(true);
      return;
    }
    setZoomFailedUri(null);
    setLoadFailedUri(null);
  }, [needsResolve, startResolve]);

  if (resolveFailed || loadFailed) {
    return (
      <Pressable
        accessibilityLabel="图片加载失败，轻触重试"
        accessibilityRole="button"
        onPress={retry}
        style={styles.imageError}
      >
        <Text style={styles.imageErrorText}>图片加载失败</Text>
        <Text style={styles.imageErrorHint}>轻触重试</Text>
      </Pressable>
    );
  }

  if (!source) {
    return (
      <View style={[styles.imageLoading, { width, height }]}>
        <ActivityIndicator color={LOADING_HINT_COLOR} size="small" />
      </View>
    );
  }

  const showLoadingHint = loadedSource !== source;

  return (
    <View style={{ width, height }}>
      {zoomLoadFailed ? (
        <Image
          source={{ uri: source }}
          contentFit="contain"
          onLoad={() => setLoadedSource(source)}
          onError={(event: ImageErrorEventData) => {
            reportImageLoadFailure("expo-image-fallback", source, event.error);
            setLoadFailedUri(source);
          }}
          style={{ width, height }}
        />
      ) : (
        <ImageZoom
          uri={source}
          maxScale={IMAGE_PREVIEW_ZOOM.maxScale}
          doubleTapScale={IMAGE_PREVIEW_ZOOM.doubleTapScale}
          isDoubleTapEnabled
          isPinchEnabled
          onLoad={() => setLoadedSource(source)}
          onError={(event: NativeImageErrorEvent) => {
            // RN Image 对超大图或特殊编码会解码失败，先退回 expo-image，再失败才提示重试
            reportImageLoadFailure("image-zoom", source, event.nativeEvent.error);
            setZoomFailedUri(source);
          }}
          style={{ width, height }}
        />
      )}
      {/* 加载提示盖在图片上层，图片还没解码时也能看到；不拦手势 */}
      {showLoadingHint ? (
        <View pointerEvents="none" style={styles.loadingLayer}>
          <ActivityIndicator color={LOADING_HINT_COLOR} size="small" />
        </View>
      ) : null}
    </View>
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

type ImagePreviewProps = {
  images: string[];
  index: number;
  onClose: () => void;
  /** 首页 banner 等需要按宽度完整展示的场景，不做左右翻页 */
  mode?: "fit-width";
  /** 需要鉴权的图片才提供：滑到该页时按索引解析成可访问地址（例如经融云 SDK 下载） */
  resolveAtIndex?: (index: number) => Promise<string>;
  /** 提供后右上角展示「保存」：入参是当前页下标，保存失败请抛带中文文案的 Error，由预览页统一提示 */
  onSaveImage?: (index: number) => Promise<void>;
};

export function ImagePreview({ images, index, onClose, mode, resolveAtIndex, onSaveImage }: ImagePreviewProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const visibleIndex = useRef(index);
  const [activeIndex, setActiveIndex] = useState(index);
  const [savingImage, setSavingImage] = useState(false);

  const prefetchNearbyImages = useCallback((centerIndex: number) => {
    // 需要鉴权的地址直接请求会失败，交给 resolveAtIndex 按需下载
    if (resolveAtIndex) return;
    const nearbyImages = images.slice(
      Math.max(0, centerIndex - 1),
      Math.min(images.length, centerIndex + 2),
    );
    if (nearbyImages.length > 0) {
      // 只预取到磁盘：原图进内存缓存会放大内存压力，返回聊天后易触发 GC 卡顿
      void Image.prefetch(nearbyImages, "disk");
    }
  }, [images, resolveAtIndex]);

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

  const saveCurrentImage = useCallback(async () => {
    if (!onSaveImage || savingImage) {
      return;
    }
    setSavingImage(true);
    try {
      await onSaveImage(activeIndex);
      showToast("已保存到相册");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败，请稍后重试");
    } finally {
      setSavingImage(false);
    }
  }, [activeIndex, onSaveImage, savingImage]);

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
              pageIndex={itemIndex}
              width={width}
              height={height}
              nearby={Math.abs(itemIndex - activeIndex) <= 1}
              resolveAt={resolveAtIndex}
            />
          </View>
        )}
      />
      <Pressable accessibilityLabel="关闭图片预览" hitSlop={12} onPress={onClose} style={[styles.closeButton, { top: insets.top + 8 }]}>
        <Text style={styles.closeText}>×</Text>
      </Pressable>
      {onSaveImage ? (
        <Pressable
          accessibilityLabel="保存图片到相册"
          accessibilityRole="button"
          disabled={savingImage}
          hitSlop={12}
          onPress={saveCurrentImage}
          style={[styles.saveButton, { top: insets.top + 8 }]}
        >
          {savingImage ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveText}>保存</Text>
          )}
        </Pressable>
      ) : null}
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
  // 与关闭按钮同一高度、同样的半透明底色，靠右对称
  saveButton: {
    position: "absolute",
    top: 8,
    right: 16,
    height: 40,
    minWidth: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  saveText: { color: "#fff", fontSize: 14, fontWeight: "500", lineHeight: 20 },
  imageLoading: { alignItems: "center", justifyContent: "center" },
  loadingLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  imageError: { flex: 1, alignItems: "center", justifyContent: "center" },
  imageErrorText: { color: "#fff", fontSize: 14 },
  imageErrorHint: { marginTop: 8, color: "#8A8A8A", fontSize: 12 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
});
