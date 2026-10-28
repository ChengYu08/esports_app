import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import { completeAvatarEdit } from "@/features/mine/utils/avatar-edit-session";
import { computeAvatarCropRect } from "@/features/mine/utils/avatar-crop";
import {
  manipulateAsync,
  SaveFormat,
} from "expo-image-manipulator";

/** 设计稿：圆直径 / 图片区边长 = 295/375 */
const CIRCLE_RATIO = 295 / 375;
const MAX_ZOOM = 5;
const OUTPUT_SIZE = 600;

export default function AvatarCropScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const route = useLocalSearchParams<{
    uri: string;
    width: string;
    height: string;
  }>();

  const imageUri = Array.isArray(route.uri) ? route.uri[0] : route.uri;
  const imageWidth = Number(Array.isArray(route.width) ? route.width[0] : route.width);
  const imageHeight = Number(
    Array.isArray(route.height) ? route.height[0] : route.height,
  );

  const [saving, setSaving] = useState(false);

  const containerSize = windowWidth;
  const circleSize = containerSize * CIRCLE_RATIO;

  // cover 基准：图片初始铺满视口的缩放
  const baseScale = Math.max(
    containerSize / (imageWidth || 1),
    containerSize / (imageHeight || 1),
  );
  const baseWidth = imageWidth * baseScale;
  const baseHeight = imageHeight * baseScale;

  const zoom = useSharedValue(1);
  const savedZoom = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const clampOffset = (value: number, zoomLevel: number) => {
    // 图片显示尺寸超出视口的部分允许各半平移，保证圆形视口内无空隙
    const max = Math.max(0, (baseWidth * zoomLevel - containerSize) / 2);
    return Math.min(Math.max(-max, value), max);
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const next = Math.min(
        MAX_ZOOM,
        Math.max(1, savedZoom.value * event.scale),
      );
      zoom.value = next;
      // 以视口中心为锚点缩放，平移量随缩放等比收缩后 clamp
      const ratio = next / (savedZoom.value || 1);
      translateX.value = clampOffset(savedTranslateX.value * ratio, next);
      translateY.value = clampOffset(savedTranslateY.value * ratio, next);
    })
    .onEnd(() => {
      savedZoom.value = zoom.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = clampOffset(
        savedTranslateX.value + event.translationX,
        zoom.value,
      );
      translateY.value = clampOffset(
        savedTranslateY.value + event.translationY,
        zoom.value,
      );
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const gesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: zoom.value },
    ],
  }));

  const circleTop = insets.top + (containerSize - circleSize) / 2;
  const circleLeft = (containerSize - circleSize) / 2;
  const circleBottom = circleTop + circleSize;
  const circleRight = circleLeft + circleSize;

  const cancel = () => {
    completeAvatarEdit(null);
    router.back();
  };

  const save = async () => {
    if (saving || !imageUri || !imageWidth || !imageHeight) return;
    setSaving(true);
    try {
      const zoomLevel = zoom.value;
      const rect = computeAvatarCropRect({
        imageWidth,
        imageHeight,
        containerSize,
        circleRatio: CIRCLE_RATIO,
        scale: baseScale * zoomLevel,
        offsetX: translateX.value,
        offsetY: translateY.value,
      });
      const result = await manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: rect.originX,
              originY: rect.originY,
              width: rect.size,
              height: rect.size,
            },
          },
          { resize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE } },
        ],
        { compress: 0.9, format: SaveFormat.JPEG },
      );
      completeAvatarEdit(result.uri);
      // 回到编辑资料页：弹出裁剪页与相册页两层
      router.dismiss(2);
    } catch {
      completeAvatarEdit(null);
      router.back();
    }
  };

  if (!imageUri || !imageWidth || !imageHeight) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.hintText}>图片加载失败，请重新选择</Text>
        <Text onPress={cancel} style={styles.hintAction}>
          返回
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      {/* 图片区：捏合缩放 + 拖动 */}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.imageArea,
            { top: insets.top, width: containerSize, height: containerSize },
          ]}
        >
          <Animated.Image
            source={{ uri: imageUri }}
            style={[
              styles.image,
              {
                left: (containerSize - baseWidth) / 2,
                top: (containerSize - baseHeight) / 2,
                width: baseWidth,
                height: baseHeight,
              },
              imageStyle,
            ]}
            resizeMode="cover"
          />
        </Animated.View>
      </GestureDetector>

      {/* 圆形挖孔遮罩：四块半透明矩形拼装 */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.maskPiece,
            {
              position: "absolute",
              top: 0,
              left: 0,
              height: circleTop,
              width: "100%",
            },
          ]}
        />
        <View
          style={[
            styles.maskPiece,
            {
              position: "absolute",
              top: circleTop,
              left: 0,
              width: circleLeft,
              height: circleSize,
            },
          ]}
        />
        <View
          style={[
            styles.maskPiece,
            {
              position: "absolute",
              top: circleTop,
              left: circleRight,
              width: containerSize - circleRight,
              height: circleSize,
            },
          ]}
        />
        <View
          style={[
            styles.maskPiece,
            { position: "absolute", top: circleBottom, width: "100%", bottom: 0 },
          ]}
        />
      </View>

      {/* 底部按钮组：取消 / 保存 */}
      <View
        style={[
          styles.buttonBar,
          { paddingBottom: Math.max(insets.bottom, 12) + 12 },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="取消"
          disabled={saving}
          onPress={cancel}
          style={[styles.actionButton, styles.cancelButton]}
        >
          <Text style={styles.buttonText}>取消</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="保存"
          disabled={saving}
          onPress={() => void save()}
          style={[styles.actionButton, styles.saveButton, saving && styles.saving]}
        >
          <Text style={styles.buttonText}>{saving ? "处理中" : "保存"}</Text>
        </Pressable>
      </View>
      {/* 图片区以下到按钮栏之间的黑色过渡区 */}
      <View
        pointerEvents="none"
        style={[styles.blackFiller, { top: insets.top + containerSize }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  imageArea: {
    position: "absolute",
    left: 0,
    overflow: "hidden",
  },
  image: {
    position: "absolute",
  },
  maskPiece: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  blackFiller: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000000",
  },
  buttonBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#FFFFFF",
  },
  actionButton: {
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    flex: 120,
    backgroundColor: "#333333",
  },
  saveButton: {
    flex: 211,
    backgroundColor: "#FE1F4C",
  },
  saving: { opacity: 0.7 },
  buttonText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  hintText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
  },
  hintAction: {
    marginTop: 16,
    color: "#FE1F4C",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
  },
});
