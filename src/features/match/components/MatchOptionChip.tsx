import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Image, type ImageSource } from "expo-image";

import { DOUYIN_SANS } from "@/shared/theme/typography";

type MatchOptionChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ImageSource;
  /** 无 icon 时用 label 首字作为占位图标 */
  iconFallback?: boolean;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function MatchOptionChip({
  label,
  selected = false,
  onPress,
  icon,
  iconFallback = false,
  trailing,
  style,
}: MatchOptionChipProps) {
  const initial = Array.from(label.trim())[0] ?? "?";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected, style]}
    >
      {icon !== undefined ? (
        <Image source={icon} style={styles.icon} />
      ) : iconFallback ? (
        <View style={[styles.icon, styles.iconPlaceholder]}>
          <Text style={styles.iconInitial}>{initial}</Text>
        </View>
      ) : null}
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 0.5,
    borderColor: "transparent",
    flexShrink: 0,
  },
  chipSelected: {
    borderColor: "#FE4267",
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 0.12,
    borderColor: "rgba(255,255,255,0.6)",
    flexShrink: 0,
  },
  iconPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  iconInitial: {
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },
  label: {
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
    color: "rgba(255,255,255,0.6)",
    flexShrink: 0,
  },
  labelSelected: {
    fontWeight: "500",
    color: "#FFFFFF",
  },
});
