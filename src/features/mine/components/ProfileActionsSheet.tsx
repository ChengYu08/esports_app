import {
  Flag24Regular,
  PersonProhibited24Regular,
} from "@fluentui/react-native-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";

type ProfileActionsSheetProps = {
  visible: boolean;
  bottomInset: number;
  isBlacklisted: boolean;
  onClose: () => void;
  onReportRequest: () => void;
  onBlockRequest: () => void;
};

export function ProfileActionsSheet({
  visible,
  bottomInset,
  isBlacklisted,
  onClose,
  onReportRequest,
  onBlockRequest,
}: ProfileActionsSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const [sheetTranslateY] = useState(() => new Animated.Value(windowHeight));
  const isClosing = useRef(false);

  useEffect(() => {
    if (!visible) return;

    isClosing.current = false;
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(windowHeight);
    const animation = Animated.parallel([
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
    ]);

    animation.start();
    return () => animation.stop();
  }, [backdropOpacity, sheetTranslateY, visible, windowHeight]);

  function closeSheet(afterClose?: () => void) {
    if (!visible || isClosing.current) return;
    isClosing.current = true;
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
      if (!finished) return;
      isClosing.current = false;
      onClose();
      afterClose?.();
    });
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={() => closeSheet()}
    >
      <Animated.View
        style={[styles.profileActionsBackdrop, { opacity: backdropOpacity }]}
      >
        <Pressable
          accessibilityLabel="关闭更多操作"
          onPress={() => closeSheet()}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          style={[
            styles.profileActionsSheet,
            {
              paddingBottom: Math.max(bottomInset, 16),
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View style={styles.profileActionsHandle} />
          <Pressable
            accessibilityLabel="举报"
            accessibilityRole="button"
            onPress={() => closeSheet(onReportRequest)}
            style={({ pressed }) => [
              styles.profileActionRow,
              pressed && styles.profileActionRowPressed,
            ]}
          >
            <Flag24Regular color="#333" height={24} width={24} />
            <Text style={styles.profileActionLabel}>举报</Text>
          </Pressable>
          <View style={styles.profileActionsDivider} />
          <Pressable
            accessibilityLabel={isBlacklisted ? "取消拉黑" : "拉黑"}
            accessibilityRole="button"
            onPress={() => closeSheet(onBlockRequest)}
            style={({ pressed }) => [
              styles.profileActionRow,
              pressed && styles.profileActionRowPressed,
            ]}
          >
            <PersonProhibited24Regular color="#333" height={24} width={24} />
            <Text style={styles.profileActionLabel}>
              {isBlacklisted ? "取消拉黑" : "拉黑"}
            </Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  profileActionsBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  profileActionsSheet: {
    paddingTop: 10,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  profileActionsHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    marginBottom: 8,
    borderRadius: 2,
    backgroundColor: "#D9D9D9",
  },
  profileActionRow: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  profileActionRowPressed: { opacity: 0.6 },
  profileActionLabel: {
    marginLeft: 12,
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
  },
  profileActionsDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 40,
    backgroundColor: "#EEEEEE",
  },
});
