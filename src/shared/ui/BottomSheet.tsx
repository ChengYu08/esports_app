import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";
import { RootSiblingParent } from "react-native-root-siblings";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

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
  // Android 的 Modal 是独立 Dialog 窗口，键盘避让有两个坐标系陷阱：
  // 1. 键盘事件的 screenY 来自 Activity 窗口，比 Dialog 里的键盘顶边高一截；
  // 2. Dialog 内容区（statusBarTranslucent 只豁免了顶部 inset）底边被导航栏 inset 抬高，
  //    距屏幕底边差一段导航栏高度，所以键盘事件给的 height（按整屏算）直接用也会多顶起这一段。
  // 实测修正：避让高度 = 键盘高度 + Dialog 内容区高度 − 屏幕高度，正好把底边差值修掉，
  // 弹层底边精确落在键盘顶边；内容区若已被系统缩放（差值为负）则不再额外避让
  const dialogHeightRef = useRef(0);
  const keyboardHeightRef = useRef(0);
  const [androidKeyboardPadding, setAndroidKeyboardPadding] = useState(0);
  // —— 临时键盘调试：把设备上的真实数值显示出来，定位后删除 ——
  const [debugLastEvent, setDebugLastEvent] = useState<{
    eY: number;
    eH: number;
  } | null>(null);
  const [debugDialogH, setDebugDialogH] = useState(0);
  const [debugModalBottom, setDebugModalBottom] = useState<number | null>(null);
  const showKbDebug = __DEV__ && keyboardAvoiding && Platform.OS === "android";

  const syncAndroidKeyboardPadding = useCallback(() => {
    const keyboardHeight = keyboardHeightRef.current;
    if (keyboardHeight <= 0) {
      setAndroidKeyboardPadding(0);
      return;
    }
    const screenHeight = Dimensions.get("screen").height;
    const nextPadding = Math.min(
      Math.max(keyboardHeight + dialogHeightRef.current - screenHeight, 0),
      keyboardHeight,
    );
    setAndroidKeyboardPadding(nextPadding);
  }, []);

  useEffect(() => {
    if (!keyboardAvoiding || Platform.OS !== "android") {
      return;
    }
    const showSubscription = Keyboard.addListener(
      "keyboardDidShow",
      (event) => {
        keyboardHeightRef.current = event.endCoordinates.height;
        syncAndroidKeyboardPadding();
        if (showKbDebug) {
          setDebugLastEvent({
            eY: event.endCoordinates.screenY,
            eH: event.endCoordinates.height,
          });
        }
      },
    );
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      keyboardHeightRef.current = 0;
      syncAndroidKeyboardPadding();
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardAvoiding, syncAndroidKeyboardPadding, showKbDebug]);

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
              onLayout={(event) => {
                // Dialog 内容区高度（避让修正公式需要）；键盘弹出后重算一次
                dialogHeightRef.current = event.nativeEvent.layout.height;
                if (showKbDebug) {
                  setDebugDialogH(event.nativeEvent.layout.height);
                }
                syncAndroidKeyboardPadding();
              }}
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
        {showKbDebug ? (
          <>
            {/* Modal 是独立窗口，嵌套 provider 读的是 Dialog 窗口自身的 inset */}
            <View style={styles.kbDebugScope}>
              <SafeAreaProvider>
                <ModalBottomInsetProbe onValue={setDebugModalBottom} />
              </SafeAreaProvider>
            </View>
            <View style={styles.kbDebugOverlay} pointerEvents="none">
              <Text style={styles.kbDebugText}>
                {`kb eY=${debugLastEvent?.eY ?? "-"} eH=${debugLastEvent?.eH ?? "-"} | H=${debugDialogH} pad=${Math.round(androidKeyboardPadding)}\nscr=${Dimensions.get("screen").height} win=${Dimensions.get("window").height} insT=${Math.round(insets.top)} insB=${Math.round(insets.bottom)} mB=${debugModalBottom ?? "-"}`}
              </Text>
            </View>
          </>
        ) : null}
      </RootSiblingParent>
    </Modal>
  );
}

/** 临时调试：读取 Modal（Dialog 窗口）自身的底部 safe-area inset，用于定位键盘避让差值 */
function ModalBottomInsetProbe({
  onValue,
}: {
  onValue: (bottom: number) => void;
}) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    onValue(insets.bottom);
  }, [insets.bottom, onValue]);
  return null;
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
  kbDebugScope: { position: "absolute", width: 0, height: 0, overflow: "hidden" },
  kbDebugOverlay: {
    position: "absolute",
    top: 48,
    left: 4,
    right: 4,
    backgroundColor: "rgba(255,235,59,.95)",
    borderRadius: 6,
    padding: 4,
  },
  kbDebugText: {
    color: "#000000",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
});
