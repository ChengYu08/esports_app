import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
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
      onRequestClose={onClose}
    >
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          // Prefer padding over Android "height": height + adjustResize inside Modal
          // can reflow the sheet and steal TextInput focus (keyboard flicker).
          behavior="padding"
          style={styles.keyboardAvoiding}
        >
          {backdrop}
        </KeyboardAvoidingView>
      ) : backdrop}
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
  sheet: { maxHeight: "100%", flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
});
