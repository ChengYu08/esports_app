import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { EmptyState } from "@/shared/ui/AsyncStates";
import { searchTypography } from "../search-typography";

const mirror = require("../../../../assets/court/ticket-search-mirror.svg");
const panda = require("../../../../assets/court/ticket-search-panda.svg");

export function SearchEmptyState() {
  return (
    <EmptyState
      message="暂无搜索结果"
      messageStyle={searchTypography.regular12}
      style={styles.empty}
      illustration={(
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.illustration}>
          <Image source={mirror} contentFit="contain" style={styles.mirror} />
          <Image source={panda} contentFit="contain" style={styles.panda} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1 },
  illustration: { width: 120, height: 120 },
  mirror: { position: "absolute", left: 0, top: -7, width: 115.824, height: 128.532 },
  panda: { position: "absolute", left: 15.792, top: 43.536, width: 79.128, height: 69.252 },
});
