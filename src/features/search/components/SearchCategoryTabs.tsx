import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { spacing } from "@/shared/theme/tokens";
import { searchTypography } from "../search-typography";
import type { SearchCategory } from "../search.types";

const indicator = require("../../../../assets/court/tab-indicator.svg");
const categories: { value: SearchCategory; label: string }[] = [
  { value: "club", label: "俱乐部" },
  { value: "user", label: "陪玩师" },
];

export function SearchCategoryTabs({
  value,
  onChange,
}: {
  value: SearchCategory;
  onChange: (category: SearchCategory) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.tabs}>
      {categories.map((category) => {
        const selected = value === category.value;
        return (
          <Pressable
            key={category.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={{ top: 8, bottom: 8 }}
            onPress={() => onChange(category.value)}
            style={styles.tab}
          >
            <Text style={[styles.label, selected && styles.selected]}>{category.label}</Text>
            {selected ? <Image source={indicator} style={styles.indicator} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", alignItems: "center", gap: 24, paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 8 },
  tab: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xs },
  label: { ...searchTypography.regular14, color: "#656566" },
  selected: { ...searchTypography.semibold16, color: "#0D0D0F" },
  indicator: { position: "absolute", bottom: 0, width: 12, height: 3 },
});
