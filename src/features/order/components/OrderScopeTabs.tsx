import { Pressable, StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import type { OrderScope } from "../order.types";

const SCOPES: readonly { value: OrderScope; label: string }[] = [
  { value: "dispatch", label: "派单中心" },
  { value: "accept", label: "我的接单" },
  { value: "place", label: "我的下单" },
];

export function OrderScopeTabs({ value, onChange }: { value: OrderScope; onChange: (scope: OrderScope) => void }) {
  return (
    <View style={styles.tabs}>
      {SCOPES.map((scope) => {
        const selected = scope.value === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={scope.value}
            onPress={() => onChange(scope.value)}
            style={styles.tab}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{scope.label}</Text>
            {selected ? <View style={styles.indicator} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    width: "100%",
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  label: { fontFamily: DOUYIN_SANS, color: "#999999", fontSize: 14, lineHeight: 20 },
  selectedLabel: { color: "#0A0A0A", fontWeight: "600" },
  indicator: { position: "absolute", bottom: 4, width: 16, height: 3, borderRadius: 2, backgroundColor: "#E01B28" },
});
