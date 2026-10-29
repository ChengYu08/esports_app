import { StyleSheet, View } from "react-native";

import type { HomeBannerSlot, HomeBannerSlotCode } from "@/features/home/api/home.types";
import { HomeBannerCard } from "./HomeBannerCard";
import { HomeBannerCarousel } from "./HomeBannerCarousel";

const floorLayouts: Record<HomeBannerSlotCode, { aspectRatio: number; columns: 1 | 2 }> = {
  APP_HOME_FLOOR1: { aspectRatio: 343 / 80, columns: 1 },
  APP_HOME_FLOOR2: { aspectRatio: 343 / 64, columns: 1 },
  APP_HOME_FLOOR3: { aspectRatio: 167 / 88, columns: 2 },
};

export function HomeBannerSections({ slots }: { slots: HomeBannerSlot[] }) {
  return slots.map((slot) => {
    if (slot.items.length === 0) {
      return null;
    }
    const layout = floorLayouts[slot.code];
    return (
      <View key={slot.code} style={[
        styles.floor,
        slot.code === "APP_HOME_FLOOR1" && styles.firstFloor,
        slot.code === "APP_HOME_FLOOR3" && styles.thirdFloor,
      ]}>
        {slot.displayMode === "CAROUSEL" ? (
          <HomeBannerCarousel slot={slot} {...layout} />
        ) : (
          <View style={styles.tiles}>
            {slot.items.map((banner, index) => (
              <View key={banner.id} style={[styles.column, layout.columns === 2 && styles.halfColumn]}>
                <HomeBannerCard
                  banner={banner}
                  label={`${slot.name} ${index + 1}`}
                  style={{ width: "100%", aspectRatio: layout.aspectRatio }}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    );
  });
}

const styles = StyleSheet.create({
  floor: { paddingHorizontal: 16, paddingVertical: 4 },
  firstFloor: { paddingTop: 8 },
  thirdFloor: { paddingBottom: 8 },
  tiles: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, rowGap: 8 },
  column: { width: "100%", paddingHorizontal: 4 },
  // 三楼固定两列，只有一张素材时保留半宽，避免拉伸。
  halfColumn: { width: "50%" },
});
