import { Pressable, StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import type { OrderFilter, OrderScope } from "../order.types";

type OrderTabsProps = {
  scope: OrderScope;
  value: OrderFilter;
  onChange: (value: OrderFilter) => void;
};

const FILTERS_BY_SCOPE: Record<OrderScope, readonly { value: OrderFilter; label: string }[]> = {
  dispatch: [
    { value: "grabbing", label: "抢单中" },
    { value: "history", label: "抢单记录" },
  ],
  accept: [
    { value: "all", label: "全部" },
    { value: "inProgress", label: "进行中" },
    { value: "completed", label: "已完成" },
    { value: "cancelled", label: "已取消" },
  ],
  place: [
    { value: "all", label: "全部" },
    { value: "inProgress", label: "进行中" },
    { value: "completed", label: "已完成" },
    { value: "cancelled", label: "已取消" },
  ],
};

export function OrderTabs({ scope, value, onChange }: OrderTabsProps) {
  return (
    <View style={styles.tabs}>
      {FILTERS_BY_SCOPE[scope].map((filter) => {
        const selected = filter.value === value;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={filter.value}
            onPress={() => onChange(filter.value)}
            style={({ pressed }) => [styles.tab, selected && styles.tabSelected, pressed && styles.tabPressed]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    width: "100%",
    height: 34,
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
  },
  tab: {
    minWidth: 32,
    paddingHorizontal: 10,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  tabSelected: { backgroundColor: "#FFF0F2", borderWidth: StyleSheet.hairlineWidth, borderColor: "#FF1F4C" },
  tabPressed: { opacity: 0.65 },
  label: {
    fontFamily: DOUYIN_SANS,
    color: "#666666",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
  },
  labelSelected: {
    color: "#FF1F4C",
    fontSize: 12,
    fontWeight: "500",
  },
});
