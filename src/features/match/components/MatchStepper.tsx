import { Add16Regular, Subtract16Regular } from "@fluentui/react-native-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";

type MatchStepperProps = {
  value: number;
  min?: number;
  onChange: (value: number) => void;
};

export function MatchStepper({ value, min = 1, onChange }: MatchStepperProps) {
  const canDecrease = value > min;

  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="减少数量"
        disabled={!canDecrease}
        hitSlop={8}
        onPress={() => {
          if (canDecrease) {
            onChange(value - 1);
          }
        }}
        style={styles.side}
      >
        <Subtract16Regular
          color="rgba(255, 255, 255, 0.6)"
          width={16}
          height={16}
          style={[styles.icon, !canDecrease && styles.iconDisabled]}
        />
      </Pressable>
      <View style={styles.divider} />
      <View style={styles.number}>
        <Text style={styles.numberText}>{value}</Text>
      </View>
      <View style={styles.divider} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="增加数量"
        hitSlop={8}
        onPress={() => onChange(value + 1)}
        style={styles.side}
      >
        <Add16Regular color="white" width={16} height={16} style={styles.icon} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  side: {
    width: 32,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 16,
    height: 16,
  },
  iconDisabled: {
    opacity: 0.35,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  number: {
    width: 40,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  numberText: {
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    color: "#FFFFFF",
    textAlign: "center",
  },
});
