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
import {
  loopSnapOffset,
  toLogicalIndex,
  withLoopBuffers,
} from "@/features/home/banner-loop";
import { HomeBannerCard } from "./HomeBannerCard";

type HomeBannerCarouselProps = {
  slot: HomeBannerSlot;
  aspectRatio: number;
  columns: 1 | 2;
  /** 外层列表滚动期间暂停自动跳页，避免与纵向滚动争抢 JS 线程。 */
  paused?: boolean;
};

export function HomeBannerCarousel({
  slot,
  aspectRatio,
  columns,
  paused = false,
}: HomeBannerCarouselProps) {
  const [width, setWidth] = useState(0);
  const height = (width - (columns - 1) * 8) / columns / aspectRatio;

  if (slot.items.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.viewport,
        width > 0 ? { height } : { aspectRatio: aspectRatio * columns },
      ]}
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
          paused={paused}
        />
      )}
    </View>
  );
}

function BannerSlides({
  slot,
  width,
  height,
  columns,
  paused,
}: {
  slot: HomeBannerSlot;
  width: number;
  height: number;
  columns: 1 | 2;
  paused: boolean;
}) {
  const list = useRef<FlatList<Banner[]>>(null);
  const pages = useMemo(
    () =>
      Array.from(
        { length: Math.ceil(slot.items.length / columns) },
        (_, page) => slot.items.slice(page * columns, (page + 1) * columns),
      ),
    [columns, slot.items],
  );
  const data = useMemo(() => withLoopBuffers(pages), [pages]);
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!focused || appState !== "active" || dragging || paused || pages.length < 2) {
      return;
    }
    const timer = setTimeout(() => {
      // 顺时针前进一页：末页滑向尾缓冲页，停稳后由 handleMomentumEnd 跳回首张真实页。
      const nextPhysical = index + 2;
      list.current?.scrollToOffset({
        offset: width * nextPhysical,
        animated: true,
      });
      setIndex(toLogicalIndex(nextPhysical, pages.length));
    }, slot.intervalMs);
    return () => clearTimeout(timer);
  }, [
    appState,
    pages.length,
    dragging,
    focused,
    index,
    paused,
    slot.intervalMs,
    width,
  ]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const physicalIndex = Math.max(
        0,
        Math.min(
          data.length - 1,
          Math.round(event.nativeEvent.contentOffset.x / width),
        ),
      );
      const snapOffset = loopSnapOffset(physicalIndex, pages.length, width);
      if (snapOffset !== null) {
        list.current?.scrollToOffset({ offset: snapOffset, animated: false });
      }
      setIndex(toLogicalIndex(physicalIndex, pages.length));
    },
    [data.length, pages.length, width],
  );

  const renderPage = useCallback(
    ({ item, index: pageIndex }: { item: Banner[]; index: number }) => {
      const logicalIndex = toLogicalIndex(pageIndex, pages.length);
      return (
        <View style={[styles.page, { width, height }]}>
          {item.map((banner, itemIndex) => (
            <HomeBannerCard
              key={banner.id}
              banner={banner}
              label={`${slot.name} ${logicalIndex * columns + itemIndex + 1}`}
              style={{ width: (width - (columns - 1) * 8) / columns, height }}
            />
          ))}
        </View>
      );
    },
    [columns, height, pages.length, slot.name, width],
  );

  return (
    <>
      <FlatList
        ref={list}
        horizontal
        pagingEnabled
        data={data}
        renderItem={renderPage}
        keyExtractor={(_, pageIndex) => String(pageIndex)}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={pages.length > 1}
        getItemLayout={(_, itemIndex) => ({
          index: itemIndex,
          length: width,
          offset: width * itemIndex,
        })}
        initialScrollIndex={pages.length > 1 ? 1 : 0}
        onScrollBeginDrag={() => setDragging(true)}
        onScrollEndDrag={() => setDragging(false)}
        onMomentumScrollEnd={handleMomentumEnd}
        initialNumToRender={2}
        windowSize={3}
      />
      {pages.length > 1 && (
        <View pointerEvents="none" style={styles.pagination}>
          {pages.map((page, pageIndex) => (
            <View
              key={page[0].id}
              style={[styles.dot, index === pageIndex && styles.activeDot]}
            />
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  viewport: { width: "100%", borderRadius: 8, overflow: "hidden" },
  page: { flexDirection: "row", gap: 8 },
  pagination: {
    position: "absolute",
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  activeDot: { width: 12, backgroundColor: "#FFFFFF" },
});
