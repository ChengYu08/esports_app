import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";
import { RootSiblingParent } from "react-native-root-siblings";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** 安卓返回键的关闭行为，缺省同 onClose；多层弹窗时内层可传自定义处理 */
  onRequestClose?: () => void;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  backdropStyle?: StyleProp<ViewStyle>;
  dismissOnBackdropPress?: boolean;
  keyboardAvoiding?: boolean;
  /** Enable for forms and static content; lists keep their own scroll container. */
  scrollable?: boolean;
  fullScreen?: boolean;
};

/** Bottom sheets use the same timing as the club detail filter sheet. */
export function BottomSheet({
  visible,
  onClose,
  onRequestClose,
  children,
  contentStyle,
  backdropStyle,
  dismissOnBackdropPress = true,
  keyboardAvoiding = false,
  scrollable = false,
  fullScreen = false,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const [sheetTranslateY] = useState(() => new Animated.Value(windowHeight));
  // Android 的 Modal 是独立 Dialog 窗口，键盘避让没有可靠的静态公式：
  // 键盘弹出后系统把 Dialog 窗口原生缩小（底边上移），但 JS 布局树的 onLayout /
  // Dimensions 全部停留在旧值，任何用「布局高度」推 pad 的公式都会失真。
  // 实测（调试浮层）：键盘事件 screenY（eY）是准确的键盘顶边；
  // measureInWindow 走原生窗口坐标，返回的是真实的可视底边。
  // 所以用反馈收敛：初始 pad = 键盘高度，之后每轮 pad += (sheet 实测底边 − eY)，
  // 底边贴住键盘顶边后差值为 0 自然停止；未缩窗的设备上 pad = eH 即稳定。
  const keyboardHeightRef = useRef(0);
  const keyboardTopRef = useRef<number | null>(null);
  const sheetRef = useRef<View>(null);
  // padding 的镜像 ref：measureInWindow 异步回调里读最新值，state 读到的是旧闭包
  const keyboardPaddingRef = useRef(0);
  const [androidKeyboardPadding, setAndroidKeyboardPadding] = useState(0);
  // 收敛尝试上限：测量异常时防止 rAF 反馈环不停空转
  const alignAttemptsRef = useRef(0);

  const applyKeyboardPadding = useCallback((next: number) => {
    keyboardPaddingRef.current = next;
    setAndroidKeyboardPadding(next);
  }, []);

  const alignSheetToKeyboard = useCallback(() => {
    if (keyboardTopRef.current == null || alignAttemptsRef.current >= 8) {
      return;
    }
    alignAttemptsRef.current += 1;
    // 等一帧再测：让上一轮 padding 变化先完成布局提交
    requestAnimationFrame(() => {
      if (keyboardTopRef.current == null) {
        return;
      }
      sheetRef.current?.measureInWindow((_x, y, _width, height) => {
        const keyboardTop = keyboardTopRef.current;
        if (keyboardTop == null) {
          return;
        }
        const visualBottom = y + height;
        const delta = visualBottom - keyboardTop;
        if (Math.abs(delta) <= 1) {
          return;
        }
        const next = Math.min(
          Math.max(keyboardPaddingRef.current + delta, 0),
          keyboardHeightRef.current,
        );
        if (Math.abs(next - keyboardPaddingRef.current) <= 1) {
          return;
        }
        applyKeyboardPadding(next);
        alignSheetToKeyboard();
      });
    });
  }, [applyKeyboardPadding]);

  useEffect(() => {
    if (!keyboardAvoiding || Platform.OS !== "android") {
      return;
    }
    const showSubscription = Keyboard.addListener(
      "keyboardDidShow",
      (event) => {
        keyboardHeightRef.current = event.endCoordinates.height;
        keyboardTopRef.current = event.endCoordinates.screenY;
        alignAttemptsRef.current = 0;
        applyKeyboardPadding(event.endCoordinates.height);
        alignSheetToKeyboard();
      },
    );
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      keyboardTopRef.current = null;
      applyKeyboardPadding(0);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardAvoiding, applyKeyboardPadding, alignSheetToKeyboard]);

  useEffect(() => {
    if (visible) {
      // Keep the native Modal mounted while the entrance animation starts.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      backdropOpacity.stopAnimation();
      sheetTranslateY.stopAnimation();
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(windowHeight);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!mounted) return;
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: windowHeight,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  // `mounted` must not restart the entrance animation after it is set.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backdropOpacity, sheetTranslateY, visible, windowHeight]);

  if (!mounted) return null;

  const backdrop = (
    <Animated.View
      style={[
        styles.backdrop,
        backdropStyle,
        {
          opacity: backdropOpacity,
          paddingTop: fullScreen ? 0 : insets.top + 12,
          paddingLeft: fullScreen ? 0 : insets.left,
          paddingRight: fullScreen ? 0 : insets.right,
        },
      ]}
    >
      <Pressable
        accessibilityLabel="关闭弹窗"
        disabled={!dismissOnBackdropPress}
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        ref={sheetRef}
        style={[
          styles.sheet,
          contentStyle,
          { transform: [{ translateY: sheetTranslateY }] },
        ]}
      >
        {scrollable ? (
          <ScrollView
            style={styles.scroll}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </Animated.View>
    </Animated.View>
  );

  return (
    <Modal
      transparent
      animationType="none"
      statusBarTranslucent
      visible
      onRequestClose={onRequestClose ?? onClose}
    >
      {/* Toast 需挂到 Modal 窗口内，否则会被原生 Modal 挡住 */}
      <RootSiblingParent>
        {keyboardAvoiding ? (
          Platform.OS === "android" ? (
            <View
              style={[
                styles.keyboardAvoiding,
                { paddingBottom: androidKeyboardPadding },
              ]}
            >
              {backdrop}
            </View>
          ) : (
            <KeyboardAvoidingView
              behavior="padding"
              style={styles.keyboardAvoiding}
            >
              {backdrop}
            </KeyboardAvoidingView>
          )
        ) : (
          backdrop
        )}
      </RootSiblingParent>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,.35)",
  },
  keyboardAvoiding: { flex: 1 },
  sheet: { maxHeight: "100%", flexShrink: 1, backgroundColor: "#FFF" },
  scroll: { flexGrow: 0, flexShrink: 1 },
});
