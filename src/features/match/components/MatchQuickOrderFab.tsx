import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { router, useIsFocused } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getProtectedNavigationAction } from "@/shared/navigation/tab-access";

const fabImage = require("../../../../assets/images/ic_quick_match_order.png");

/** 快速下单整图 66×60 */
const FAB_WIDTH = 66;
const FAB_HEIGHT = 60;
const EDGE_MARGIN = 8;
/** 与 AppTabBar 一致：内容区 58 + 底部安全区 */
const TAB_CONTENT_HEIGHT = 58;
/**
 * Figma 2364:96434 / 812 画布：FAB 底边 y=684 → 距屏幕底 128；
 * Tabbar 顶 y=732 → FAB 底到 Tab 顶间距 48。
 * 用「距屏幕底」定位，避免 Tab 场景高度是否含 Tab 时重复扣减。
 */
const FIGMA_FAB_BOTTOM_FROM_SCREEN = 128;
const MIN_GAP_ABOVE_TAB = 8;
const DRAG_THRESHOLD = 6;

type HostLayout = {
  width: number;
  height: number;
  pageX: number;
  pageY: number;
};

export function MatchQuickOrderFab() {
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isAuthenticated = useAuthStore((state) =>
    Boolean(state.accessToken && state.user),
  );
  const overlayRef = useRef<View>(null);
  const [host, setHost] = useState<HostLayout | null>(null);

  const tabBarHeight = TAB_CONTENT_HEIGHT + insets.bottom;
  const tabTopInWindow = windowHeight - tabBarHeight;
  /** 对齐 Figma 距底 128，且不压到 Tab（至少留 MIN_GAP_ABOVE_TAB） */
  const fabBottomInWindow = Math.min(
    windowHeight - FIGMA_FAB_BOTTOM_FROM_SCREEN,
    tabTopInWindow - MIN_GAP_ABOVE_TAB,
  );

  const hostWidth = host?.width ?? windowWidth;
  const hostPageY = host?.pageY ?? 0;

  const minX = EDGE_MARGIN;
  const maxX = Math.max(minX, hostWidth - EDGE_MARGIN - FAB_WIDTH);
  const minY = Math.max(EDGE_MARGIN, insets.top - hostPageY + EDGE_MARGIN);
  const maxY = Math.max(
    minY,
    tabTopInWindow - MIN_GAP_ABOVE_TAB - FAB_HEIGHT - hostPageY,
  );
  const defaultX = maxX;
  const defaultY = Math.min(
    maxY,
    Math.max(minY, fabBottomInWindow - FAB_HEIGHT - hostPageY),
  );

  const left = useSharedValue(defaultX);
  const top = useSharedValue(defaultY);
  const dragStartX = useSharedValue(defaultX);
  const dragStartY = useSharedValue(defaultY);
  const initialized = useSharedValue(false);
  const boundsMinX = useSharedValue(minX);
  const boundsMaxX = useSharedValue(maxX);
  const boundsMinY = useSharedValue(minY);
  const boundsMaxY = useSharedValue(maxY);
  const snapWidth = useSharedValue(hostWidth);

  const syncHostLayout = useCallback(() => {
    overlayRef.current?.measureInWindow((pageX, pageY, width, height) => {
      if (width <= 0 || height <= 0) return;
      setHost({ width, height, pageX, pageY });
    });
  }, []);

  const onOverlayLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      syncHostLayout();
    },
    [syncHostLayout],
  );

  useEffect(() => {
    if (!focused) return;
    syncHostLayout();
  }, [focused, syncHostLayout, windowHeight, windowWidth, insets.bottom]);

  useEffect(() => {
    if (!host) return;

    boundsMinX.value = minX;
    boundsMaxX.value = maxX;
    boundsMinY.value = minY;
    boundsMaxY.value = maxY;
    snapWidth.value = hostWidth;

    if (initialized.value) {
      left.value = Math.min(maxX, Math.max(minX, left.value));
      top.value = Math.min(maxY, Math.max(minY, top.value));
      return;
    }
    left.value = defaultX;
    top.value = defaultY;
    initialized.value = true;
  }, [
    boundsMaxX,
    boundsMaxY,
    boundsMinX,
    boundsMinY,
    defaultX,
    defaultY,
    host,
    hostWidth,
    initialized,
    left,
    maxX,
    maxY,
    minX,
    minY,
    snapWidth,
    top,
  ]);

  const openMatch = useCallback(() => {
    const action = getProtectedNavigationAction("match", isAuthenticated);
    if (action.type === "login") {
      router.replace("/login");
      return;
    }
    router.push("/match");
  }, [isAuthenticated]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(DRAG_THRESHOLD)
      .maxPointers(1)
      .onStart(() => {
        dragStartX.set(clamp(left.get(), boundsMinX.get(), boundsMaxX.get()));
        dragStartY.set(clamp(top.get(), boundsMinY.get(), boundsMaxY.get()));
      })
      .onUpdate((event) => {
        left.set(
          clamp(
            dragStartX.get() + event.translationX,
            boundsMinX.get(),
            boundsMaxX.get(),
          ),
        );
        top.set(
          clamp(
            dragStartY.get() + event.translationY,
            boundsMinY.get(),
            boundsMaxY.get(),
          ),
        );
      })
      .onEnd(() => {
        const centerX = left.get() + FAB_WIDTH / 2;
        const snapToLeft = centerX < snapWidth.get() / 2;
        left.set(
          withSpring(snapToLeft ? boundsMinX.get() : boundsMaxX.get(), {
            damping: 26,
            stiffness: 160,
          }),
        );
        top.set(clamp(top.get(), boundsMinY.get(), boundsMaxY.get()));
      });

    const tap = Gesture.Tap()
      .maxDistance(DRAG_THRESHOLD)
      .runOnJS(true)
      .onEnd((_event, success) => {
        if (success) openMatch();
      });

    return Gesture.Race(pan, tap);
  }, [
    boundsMaxX,
    boundsMaxY,
    boundsMinX,
    boundsMinY,
    dragStartX,
    dragStartY,
    left,
    openMatch,
    snapWidth,
    top,
  ]);

  const positionStyle = useAnimatedStyle(() => ({
    left: left.get(),
    top: top.get(),
  }));

  if (!focused) return null;

  return (
    <View
      ref={overlayRef}
      pointerEvents="box-none"
      style={styles.overlay}
      onLayout={onOverlayLayout}
    >
      {host ? (
        <GestureDetector gesture={gesture}>
          <Animated.View
            collapsable={false}
            accessible
            accessibilityRole="button"
            accessibilityLabel="快速下单"
            accessibilityHint="点击进入快速匹配，可拖动到左右边缘"
            onAccessibilityTap={openMatch}
            style={[styles.fab, { left: defaultX, top: defaultY }, positionStyle]}
          >
            <Image
              source={fabImage}
              contentFit="contain"
              style={styles.fabImage}
            />
          </Animated.View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },
  fab: {
    position: "absolute",
    width: FAB_WIDTH,
    height: FAB_HEIGHT,
  },
  fabImage: {
    width: FAB_WIDTH,
    height: FAB_HEIGHT,
  },
});
