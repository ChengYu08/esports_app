import { Image, type ImageSource } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

type LightGameOptionChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ImageSource;
  iconFallback?: boolean;
};

export function LightGameOptionChip({
  label,
  selected = false,
  onPress,
  icon,
  iconFallback = false,
}: LightGameOptionChipProps) {
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
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: "#F5F6F7",
    borderWidth: 0.5,
    borderColor: "transparent",
    flexShrink: 0,
  },
  chipSelected: {
    backgroundColor: "#FFF5F7",
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
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  iconInitial: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: "#656566",
  },
  label: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
    color: "#0D0D0F",
    textAlign: "center",
    flexShrink: 0,
  },
  labelSelected: {
    fontWeight: "500",
    color: "#FE1F4C",
  },
});
