import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  backdropStyle?: StyleProp<ViewStyle>;
  dismissOnBackdropPress?: boolean;
  keyboardAvoiding?: boolean;
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
}: BottomSheetProps) {
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
      style={[styles.backdrop, backdropStyle, { opacity: backdropOpacity }]}
    >
      <Pressable
        accessibilityLabel="关闭弹窗"
        disabled={!dismissOnBackdropPress}
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[contentStyle, { transform: [{ translateY: sheetTranslateY }] }]}
      >
        {children}
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
          behavior={Platform.OS === "ios" ? "padding" : "height"}
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
});
