import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { showToast } from "@/shared/ui/app-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, { Path } from "react-native-svg";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import {
  completeAvatarEdit,
  isAvatarEditActive,
} from "@/features/mine/utils/avatar-edit-session";
import {
  clampAvatarPan,
  computeAvatarCropRect,
} from "@/features/mine/utils/avatar-crop";
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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const route = useLocalSearchParams<{
    uri: string;
    width: string;
    height: string;
  }>();

  const imageUri = Array.isArray(route.uri) ? route.uri[0] : route.uri;
  const imageWidth = Number(
    Array.isArray(route.width) ? route.width[0] : route.width,
  );
  const imageHeight = Number(
    Array.isArray(route.height) ? route.height[0] : route.height,
  );

  const [saving, setSaving] = useState(false);

  const containerSize = screenWidth;
  const circleRadius = (containerSize * CIRCLE_RATIO) / 2;

  // 底部悬浮按钮栏总高：上 12 + 按钮 42 + 下（安全区/12 + 12）
  const buttonBarHeight = 12 + 42 + Math.max(insets.bottom, 12) + 12;

  // 裁剪区在扣除顶部安全区与底部按钮栏后的剩余空间内垂直居中
  const availableHeight = Math.max(
    0,
    screenHeight - insets.top - buttonBarHeight,
  );
  const areaTop = insets.top + Math.max(0, (availableHeight - containerSize) / 2);
  const circleCenterX = containerSize / 2;
  const circleCenterY = areaTop + containerSize / 2;

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

  // 手势返回/物理返回键时兜底终结会话，避免编辑资料页悬挂在等待态
  useEffect(() => {
    return () => {
      if (isAvatarEditActive()) {
        completeAvatarEdit(null);
      }
    };
  }, []);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const next = Math.min(
        MAX_ZOOM,
        Math.max(1, savedZoom.value * event.scale),
      );
      zoom.value = next;
      // 以视口中心为锚点缩放，平移量随缩放等比收缩后按轴 clamp
      const ratio = next / (savedZoom.value || 1);
      const clamped = clampAvatarPan({
        offsetX: savedTranslateX.value * ratio,
        offsetY: savedTranslateY.value * ratio,
        displayedWidth: baseWidth * next,
        displayedHeight: baseHeight * next,
        containerSize,
      });
      translateX.value = clamped.offsetX;
      translateY.value = clamped.offsetY;
    })
    .onEnd(() => {
      savedZoom.value = zoom.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const clamped = clampAvatarPan({
        offsetX: savedTranslateX.value + event.translationX,
        offsetY: savedTranslateY.value + event.translationY,
        displayedWidth: baseWidth * zoom.value,
        displayedHeight: baseHeight * zoom.value,
        containerSize,
      });
      translateX.value = clamped.offsetX;
      translateY.value = clamped.offsetY;
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

  const cancel = () => {
    completeAvatarEdit(null);
    // 取消视为放弃本次流程，直接回编辑资料页
    router.dismiss(2);
  };

  const save = async () => {
    if (saving || !imageUri || !imageWidth || !imageHeight) {
      return;
    }
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
      showToast("图片处理失败，请重试");
      setSaving(false);
    }
  };

  if (!imageUri || !imageWidth || !imageHeight) {
    return (
      <View style={[styles.screen, styles.center]}>
        <StatusBar style="light" />
        <Text style={styles.hintText}>图片加载失败，请重新选择</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            completeAvatarEdit(null);
            router.dismiss(2);
          }}
          style={styles.hintActionWrap}
        >
          <Text style={styles.hintAction}>返回</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {/* 图片区：捏合缩放 + 拖动。在扣除顶栏与底部悬浮按钮栏后的剩余空间内垂直居中 */}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.imageArea,
            { top: areaTop, width: containerSize, height: containerSize },
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

      {/* 圆形挖孔遮罩：evenodd 路径（全屏矩形 + 圆形子路径）+ 白色圆环描边 */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg style={StyleSheet.absoluteFill}>
          <Path
            d={`M0 0 H${screenWidth} V${screenHeight} H0 Z M${circleCenterX} ${circleCenterY} m-${circleRadius} 0 a${circleRadius} ${circleRadius} 0 1 0 ${circleRadius * 2} 0 a${circleRadius} ${circleRadius} 0 1 0 -${circleRadius * 2} 0 Z`}
            fill="rgba(0,0,0,0.6)"
            fillRule="evenodd"
          />
        </Svg>
        <View
          style={[
            styles.circleEdge,
            {
              left: circleCenterX - circleRadius,
              top: circleCenterY - circleRadius,
              width: circleRadius * 2,
              height: circleRadius * 2,
              borderRadius: circleRadius,
            },
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
  circleEdge: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
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
  hintActionWrap: {
    marginTop: 16,
  },
  hintAction: {
    color: "#FE1F4C",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
  },
});
