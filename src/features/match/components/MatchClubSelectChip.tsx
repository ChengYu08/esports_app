import { Image } from "expo-image";
import { Pressable, StyleSheet, Text } from "react-native";

const arrowDownIcon = require("../../../../assets/svgs/icon-arrow-down.svg");

type MatchClubSelectChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function MatchClubSelectChip({
  label,
  selected = false,
  onPress,
}: MatchClubSelectChipProps) {
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
      <Image source={arrowDownIcon} style={styles.arrowIcon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 0.5,
    borderColor: "transparent",
    flexShrink: 0,
    overflow: "hidden",
  },
  chipSelected: {
    borderColor: "#FE4267",
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
    color: "#F5F6F7",
  },
  arrowIcon: {
    width: 16,
    height: 16,
    flexShrink: 0,
  },
});
