import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useIsFocused } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getProtectedNavigationAction } from "@/shared/navigation/tab-access";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const controllerImage = require("../../../../assets/images/quick-order-controller.png");
const glowImage = require("../../../../assets/svgs/quick-order-glow.svg");
const shadowImage = require("../../../../assets/svgs/quick-order-shadow.svg");

/** Figma 1184:152732 快速下单 */
const FAB_WIDTH = 66;
const FAB_HEIGHT = 60;
const EDGE_MARGIN = 8;
const TAB_CONTENT_HEIGHT = 58;
const ABOVE_TAB_GAP = 12;
const DRAG_THRESHOLD = 6;

const RED_GRADIENT = {
  colors: ["#FF1F2E", "#FF1F69"] as const,
  start: { x: 0.05, y: 0.2 },
  end: { x: 0.95, y: 0.9 },
};

const BLUE_GLOW_GRADIENT = {
  colors: ["#4589FF", "#49C8FF"] as const,
  start: { x: 0.2, y: 0.3 },
  end: { x: 0.9, y: 0.8 },
};

export function MatchQuickOrderFab() {
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isAuthenticated = useAuthStore((state) =>
    Boolean(state.accessToken && state.user),
  );

  const minX = EDGE_MARGIN + insets.left;
  const maxX = Math.max(minX, width - EDGE_MARGIN - insets.right - FAB_WIDTH);
  const minY = insets.top + EDGE_MARGIN;
  const maxY = Math.max(
    minY,
    height - insets.bottom - TAB_CONTENT_HEIGHT - ABOVE_TAB_GAP - FAB_HEIGHT,
  );
  const defaultX = maxX;
  const defaultY = maxY;

  const left = useSharedValue(defaultX);
  const top = useSharedValue(defaultY);
  const dragStartX = useSharedValue(defaultX);
  const dragStartY = useSharedValue(defaultY);
  const initialized = useSharedValue(false);
  const boundsMinX = useSharedValue(minX);
  const boundsMaxX = useSharedValue(maxX);
  const boundsMinY = useSharedValue(minY);
  const boundsMaxY = useSharedValue(maxY);
  const screenWidth = useSharedValue(width);

  useEffect(() => {
    boundsMinX.value = minX;
    boundsMaxX.value = maxX;
    boundsMinY.value = minY;
    boundsMaxY.value = maxY;
    screenWidth.value = width;

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
    initialized,
    left,
    maxX,
    maxY,
    minX,
    minY,
    screenWidth,
    top,
    width,
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
        dragStartX.set(
          clamp(left.get(), boundsMinX.get(), boundsMaxX.get()),
        );
        dragStartY.set(
          clamp(top.get(), boundsMinY.get(), boundsMaxY.get()),
        );
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
        const snapToLeft = centerX < screenWidth.get() / 2;
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
    screenWidth,
    top,
  ]);

  const positionStyle = useAnimatedStyle(() => ({
    left: left.get(),
    top: top.get(),
  }));

  if (!focused) return null;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
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
          <View style={styles.blueGlowWrap} pointerEvents="none">
            <LinearGradient
              colors={[...BLUE_GLOW_GRADIENT.colors]}
              start={BLUE_GLOW_GRADIENT.start}
              end={BLUE_GLOW_GRADIENT.end}
              style={styles.blueGlow}
            />
          </View>
          <Image
            source={shadowImage}
            contentFit="contain"
            style={styles.shadow}
          />
          <Image
            source={glowImage}
            contentFit="contain"
            style={styles.controllerGlow}
          />
          <Image
            source={controllerImage}
            contentFit="contain"
            style={styles.controller}
          />
          <View style={styles.pillWrap} pointerEvents="none">
            <LinearGradient
              colors={[...RED_GRADIENT.colors]}
              start={RED_GRADIENT.start}
              end={RED_GRADIENT.end}
              style={styles.pill}
            >
              <Text style={styles.pillText}>快速下单</Text>
            </LinearGradient>
          </View>
        </Animated.View>
      </GestureDetector>
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
    elevation: 8,
    shadowColor: "#D22727",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  blueGlowWrap: {
    position: "absolute",
    left: -3,
    bottom: 4,
    width: 70,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
  },
  blueGlow: {
    width: 66,
    height: 22,
    borderRadius: 999,
    transform: [{ rotate: "-20deg" }],
    opacity: 0.9,
  },
  shadow: {
    position: "absolute",
    left: 22,
    top: 20,
    width: 24,
    height: 14,
    transform: [{ rotate: "-22deg" }],
  },
  controllerGlow: {
    position: "absolute",
    left: 8,
    top: 28,
    width: 28,
    height: 18,
    transform: [{ rotate: "-10deg" }],
  },
  controller: {
    position: "absolute",
    left: 5,
    top: -4,
    width: 56,
    height: 56,
  },
  pillWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 12,
    fontWeight: "700",
    textShadowColor: "rgba(146, 17, 19, 0.15)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
