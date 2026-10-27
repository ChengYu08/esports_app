import type { GameCategory } from "@/features/home/api/home.types";
import { radius, spacing } from "@/shared/theme/tokens";
import { SYSTEM_FONT } from "@/shared/theme/typography";
import { CachedImage } from "@/shared/ui/CachedImage";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

type GameCategoryTabsProps = {
  categories: GameCategory[];
  selectedId: string;
  onChange: (id: string) => void;
};

export function GameCategoryTabs({
  categories,
  selectedId,
  onChange,
}: GameCategoryTabsProps) {
  const { width } = useWindowDimensions();
  const itemWidth = (width - spacing.lg * 2 - spacing.sm * 2) / 3;

  if (categories.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {categories.map((category) => {
        const selected = category.id === selectedId;
        return (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={category.name}
            accessibilityState={{ selected }}
            onPress={() => onChange(selected ? "" : category.id)}
            style={[styles.item, { width: itemWidth }]}
          >
            {category.iconUrl ? (
              <CachedImage
                source={{ uri: category.iconUrl }}
                contentFit="contain"
                style={styles.image}
              />
            ) : (
              <View style={styles.fallback}>
                <Text numberOfLines={1} style={styles.label}>
                  {category.name}
                </Text>
              </View>
            )}
            {selected && <View pointerEvents="none" style={styles.selected} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  item: { height: 56, borderRadius: radius.md, overflow: "hidden" },
  selected: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderColor: "#FE4267",
    borderWidth: 1.5,
    borderRadius: radius.md,
  },
  image: { width: "100%", height: "100%" },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F6F7",
    paddingHorizontal: spacing.xs,
  },
  label: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    fontWeight: "500",
    color: "#0D0D0F",
    lineHeight: 18,
  },
});
