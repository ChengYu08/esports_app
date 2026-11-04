import { Image, type ImageSource } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

type MatchGameOptionChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ImageSource;
  iconFallback?: boolean;
};

export function MatchGameOptionChip({
  label,
  selected = false,
  onPress,
  icon,
  iconFallback = false,
}: MatchGameOptionChipProps) {
  const initial = Array.from(label.trim())[0] ?? "?";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },
  label: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    flexShrink: 0,
  },
  labelSelected: {
    fontWeight: "500",
    color: "#FFFFFF",
  },
});
