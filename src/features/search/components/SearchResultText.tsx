import { Image } from "expo-image";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";

import { colors, spacing } from "@/shared/theme/tokens";
import { searchTypography } from "../search-typography";

const idIcon = require("../../../../assets/court/ticket-id.svg");

export function HighlightedSearchText({
  text,
  keyword,
  style,
}: {
  text: string;
  keyword: string;
  style: StyleProp<TextStyle>;
}) {
  const index = keyword ? text.toLocaleLowerCase().indexOf(keyword.toLocaleLowerCase()) : -1;
  if (index < 0) {
    return <Text numberOfLines={1} style={style}>{text}</Text>;
  }
  return (
    <Text numberOfLines={1} style={style}>
      {text.slice(0, index)}
      <Text style={styles.highlight}>{text.slice(index, index + keyword.length)}</Text>
      {text.slice(index + keyword.length)}
    </Text>
  );
}

export function SearchResultId({ id, keyword }: { id: string; keyword: string }) {
  return (
    <View accessibilityLabel={`ID ${id}`} style={styles.idRow}>
      <Image source={idIcon} style={styles.idIcon} />
      <HighlightedSearchText text={id} keyword={keyword} style={styles.idText} />
    </View>
  );
}

const styles = StyleSheet.create({
  highlight: { color: colors.brand },
  idRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  idIcon: { flexShrink: 0, width: 16, height: 16 },
  idText: { ...searchTypography.regular12, flexShrink: 1, color: "#979799" },
});
