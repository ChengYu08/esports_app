import { Pressable, StyleSheet, Text } from "react-native";

type LightOptionChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function LightOptionChip({
  label,
  selected = false,
  onPress,
}: LightOptionChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 32,
    minWidth: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: "#F5F6F7",
    borderWidth: 0.5,
    borderColor: "transparent",
    flexShrink: 0,
    overflow: "hidden",
  },
  chipSelected: {
    backgroundColor: "#FFF5F7",
    borderColor: "#FE4267",
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
