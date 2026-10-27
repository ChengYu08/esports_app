import { Image } from "expo-image";
import { router } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Club } from "@/features/home/api/home.types";
import { colors, radius, spacing } from "@/shared/theme/tokens";
import { CachedImage } from "@/shared/ui/CachedImage";
import { searchTypography } from "../search-typography";
import { HighlightedSearchText, SearchResultId } from "./SearchResultText";

const memberIcon = require("../../../../assets/home/h_user.svg");

export const ClubSearchCard = memo(function ClubSearchCard({
  club,
  keyword,
  onSelect,
}: {
  club: Club;
  keyword: string;
  onSelect: (club: Club) => void;
}) {
  const clubId = club.clubCode || club.id;
  const matchesId = /^\d+$/.test(keyword) && clubId.includes(keyword);
  const openClub = () => {
    onSelect(club);
    router.push({ pathname: "/club/[id]", params: { id: club.id } });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看${club.name}详情`}
      onPress={openClub}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.avatar}>
        {club.coverUrl ? (
          <CachedImage contentFit="cover" source={{ uri: club.coverUrl }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>{club.name.slice(0, 1)}</Text>
        )}
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <HighlightedSearchText text={club.name} keyword={keyword} style={styles.name} />
          <View style={styles.members}>
            <Image source={memberIcon} tintColor="#7F7F80" style={styles.memberIcon} />
            <Text style={styles.memberCount}>{club.memberCount}人</Text>
          </View>
        </View>
        {matchesId ? (
          <SearchResultId id={clubId} keyword={keyword} />
        ) : (
          <Text numberOfLines={1} style={styles.description}>{club.description}</Text>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.lg,
    paddingHorizontal: spacing.lg, paddingVertical: 10, backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: "#F7F7F7" },
  avatar: {
    flexShrink: 0, width: 44, height: 44, borderRadius: radius.md,
    overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: colors.border,
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { ...searchTypography.avatar, color: colors.textSecondary },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  name: { ...searchTypography.medium14, flexShrink: 1, color: "#0D0D0F" },
  members: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  memberIcon: { width: 12, height: 12 },
  memberCount: { ...searchTypography.regular11, color: "#7F7F80" },
  description: { ...searchTypography.regular12, color: colors.textSecondary },
});
