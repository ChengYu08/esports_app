import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import type { Banner, HomeBannerSlot } from "@/features/home/api/home.types";
import { HomeBannerCard } from "./HomeBannerCard";

type HomeBannerCarouselProps = {
  slot: HomeBannerSlot;
  aspectRatio: number;
  columns: 1 | 2;
};

export function HomeBannerCarousel({ slot, aspectRatio, columns }: HomeBannerCarouselProps) {
  const [width, setWidth] = useState(0);
  const height = (width - (columns - 1) * 8) / columns / aspectRatio;

  if (slot.items.length === 0) {
    return null;
  }

  return (
    <View
      style={[styles.viewport, width > 0 ? { height } : { aspectRatio: aspectRatio * columns }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {/* 素材下发或屏幕宽度变化后重置页码，避免停留在不存在的页上。 */}
      {width > 0 && (
        <BannerSlides
          key={JSON.stringify([width, columns, slot])}
          slot={slot}
          width={width}
          height={height}
          columns={columns}
        />
      )}
    </View>
  );
}

function BannerSlides({ slot, width, height, columns }: {
  slot: HomeBannerSlot;
  width: number;
  height: number;
  columns: 1 | 2;
}) {
  const list = useRef<FlatList<Banner[]>>(null);
  const pages = useMemo(() => Array.from(
    { length: Math.ceil(slot.items.length / columns) },
    (_, page) => slot.items.slice(page * columns, (page + 1) * columns),
  ), [columns, slot.items]);
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!focused || appState !== "active" || dragging || pages.length < 2) {
      return;
    }
    const timer = setTimeout(() => {
      const nextIndex = (index + 1) % pages.length;
      list.current?.scrollToOffset({ offset: width * nextIndex, animated: true });
      setIndex(nextIndex);
    }, slot.intervalMs);
    return () => clearTimeout(timer);
  }, [appState, pages.length, dragging, focused, index, slot.intervalMs, width]);

  const updateIndex = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.max(0, Math.min(pages.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))));
  }, [pages.length, width]);

  const renderPage = useCallback(({ item, index: pageIndex }: { item: Banner[]; index: number }) => (
    <View style={[styles.page, { width, height }]}>
      {item.map((banner, itemIndex) => (
        <HomeBannerCard
          key={banner.id}
          banner={banner}
          label={`${slot.name} ${pageIndex * columns + itemIndex + 1}`}
          style={{ width: (width - (columns - 1) * 8) / columns, height }}
        />
      ))}
    </View>
  ), [columns, height, slot.name, width]);

  return (
    <>
      <FlatList
        ref={list}
        horizontal
        pagingEnabled
        data={pages}
        renderItem={renderPage}
        keyExtractor={(page) => page.map((banner) => banner.id).join(",")}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={pages.length > 1}
        getItemLayout={(_, itemIndex) => ({ index: itemIndex, length: width, offset: width * itemIndex })}
        onScrollBeginDrag={() => setDragging(true)}
        onScrollEndDrag={() => setDragging(false)}
        onMomentumScrollEnd={updateIndex}
        initialNumToRender={2}
        windowSize={3}
      />
      {pages.length > 1 && (
        <View pointerEvents="none" style={styles.pagination}>
          {pages.map((page, pageIndex) => (
            <View key={page[0].id} style={[styles.dot, index === pageIndex && styles.activeDot]} />
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  viewport: { width: "100%", borderRadius: 8, overflow: "hidden" },
  page: { flexDirection: "row", gap: 8 },
  pagination: { position: "absolute", bottom: 6, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.45)" },
  activeDot: { width: 12, backgroundColor: "#FFFFFF" },
});
