import { Pressable, StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import type { OrderFilter } from "../order.types";

const FILTERS = [
  { value: "all", label: "全部" },
  { value: "inProgress", label: "进行中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
] satisfies readonly { value: OrderFilter; label: string }[];

type OrderTabsProps = {
  value: OrderFilter;
  onChange: (value: OrderFilter) => void;
};

export function OrderTabs({ value, onChange }: OrderTabsProps) {
  return (
    <View style={styles.tabs}>
      {FILTERS.map((filter) => {
        const selected = filter.value === value;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={filter.value}
            onPress={() => onChange(filter.value)}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {filter.label}
            </Text>
            {selected && <View style={styles.indicator} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    width: "100%",
    height: 54,
    paddingHorizontal: 8,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  tab: {
    minWidth: 48,
    paddingHorizontal: 8,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tabPressed: { opacity: 0.65 },
  label: {
    fontFamily: DOUYIN_SANS,
    color: "#999999",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "400",
  },
  labelSelected: {
    color: "#0A0A0A",
    fontSize: 16,
    fontWeight: "500",
  },
  indicator: {
    position: "absolute",
    bottom: 3,
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#E01B28",
  },
});
