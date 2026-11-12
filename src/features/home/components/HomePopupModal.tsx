import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Banner } from "@/features/home/api/home.types";
import { getBannerAction } from "@/features/home/home-banner.contract";
import { fitContainSize, popupViewportSize } from "@/features/home/home-popup-layout";
import { navigateBannerAction } from "@/features/home/navigate-banner-action";
import { CachedImage } from "@/shared/ui/CachedImage";

const HORIZONTAL_INSET = 32;
const CLOSE_AREA_HEIGHT = 72;
const VERTICAL_EXTRA_INSET = 48;

type HomePopupModalProps = {
  visible: boolean;
  items: Banner[];
  intervalMs: number;
  onDismiss: () => void;
};

type NaturalSize = { width: number; height: number };

export function HomePopupModal({
  visible,
  items,
  intervalMs,
  onDismiss,
}: HomePopupModalProps) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Banner>>(null);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [naturalByUrl, setNaturalByUrl] = useState<Record<string, NaturalSize>>({});

  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  const maxWidth = Math.max(0, screenWidth - HORIZONTAL_INSET * 2);
  const maxHeight = Math.max(
    0,
    screenHeight - insets.top - insets.bottom - CLOSE_AREA_HEIGHT - VERTICAL_EXTRA_INSET,
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    let cancelled = false;
    for (const item of items) {
      const uri = item.imageUrl;
      Image.getSize(
        uri,
        (width, height) => {
          if (cancelled) {
            return;
          }
          setNaturalByUrl((prev) => (prev[uri] ? prev : { ...prev, [uri]: { width, height } }));
        },
        () => {
          if (cancelled) {
            return;
          }
          // 量图失败时用 1:1 兜底，避免弹层空白。
          setNaturalByUrl((prev) => (prev[uri] ? prev : { ...prev, [uri]: { width: 1, height: 1 } }));
        },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [items, visible]);

  const fittedByUrl = useMemo(() => {
    const map: Record<string, { width: number; height: number }> = {};
    for (const item of items) {
      const natural = naturalByUrl[item.imageUrl];
      if (!natural) {
        continue;
      }
      map[item.imageUrl] = fitContainSize(natural.width, natural.height, maxWidth, maxHeight);
    }
    return map;
  }, [items, maxHeight, maxWidth, naturalByUrl]);

  const viewport = useMemo(() => {
    const fitted = items
      .map((item) => fittedByUrl[item.imageUrl])
      .filter((size): size is { width: number; height: number } => Boolean(size));
    if (fitted.length === 0) {
      return { width: maxWidth, height: Math.min(maxHeight, maxWidth) };
    }
    return popupViewportSize(fitted, maxWidth, maxHeight);
  }, [fittedByUrl, items, maxHeight, maxWidth]);

  const canAutoPlay = visible && items.length > 1 && !dragging && viewport.width > 0;

  useEffect(() => {
    if (!canAutoPlay) {
      return;
    }
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % items.length;
        listRef.current?.scrollToOffset({ offset: next * viewport.width, animated: true });
        return next;
      });
    }, Math.max(intervalMs, 1000));
    return () => clearInterval(timer);
  }, [canAutoPlay, intervalMs, items.length, viewport.width]);

  useEffect(() => {
    if (visible) {
      setIndex(0);
      setDragging(false);
    }
  }, [visible]);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(event.nativeEvent.contentOffset.x / Math.max(viewport.width, 1));
      setIndex(Math.min(Math.max(page, 0), items.length - 1));
      setDragging(false);
    },
    [items.length, viewport.width],
  );

  async function handlePressItem(banner: Banner) {
    // 点击跳转后保持弹窗，便于返回首页时仍可关闭或继续浏览。
    await navigateBannerAction(banner);
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.content}>
          <View style={[styles.viewport, { width: viewport.width, height: viewport.height }]}>
            <FlatList
              ref={listRef}
              data={items}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              bounces={false}
              onScrollBeginDrag={() => setDragging(true)}
              onMomentumScrollEnd={onMomentumEnd}
              getItemLayout={(_, itemIndex) => ({
                length: viewport.width,
                offset: viewport.width * itemIndex,
                index: itemIndex,
              })}
              renderItem={({ item }) => {
                const fitted = fittedByUrl[item.imageUrl] ?? {
                  width: viewport.width,
                  height: viewport.height,
                };
                const clickable = getBannerAction(item).type !== "none";
                return (
                  <Pressable
                    accessibilityRole={clickable ? "button" : "image"}
                    accessibilityLabel={item.title || "开屏活动"}
                    disabled={!clickable}
                    onPress={() => {
                      void handlePressItem(item);
                    }}
                    style={[styles.slide, { width: viewport.width, height: viewport.height }]}
                  >
                    <CachedImage
                      source={{ uri: item.imageUrl }}
                      contentFit="contain"
                      style={{ width: fitted.width, height: fitted.height }}
                    />
                  </Pressable>
                );
              }}
            />
          </View>

          {items.length > 1 ? (
            <View style={styles.dots}>
              {items.map((item, dotIndex) => (
                <View
                  key={item.id}
                  style={[styles.dot, dotIndex === index && styles.dotActive]}
                />
              ))}
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭开屏弹窗"
            hitSlop={12}
            onPress={onDismiss}
            style={styles.closeButton}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: HORIZONTAL_INSET,
  },
  content: {
    alignItems: "center",
  },
  viewport: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  slide: {
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
  },
  closeButton: {
    marginTop: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "300",
    lineHeight: 30,
    marginTop: -2,
  },
});
