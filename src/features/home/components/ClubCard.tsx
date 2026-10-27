import type { Club } from "@/features/home/api/home.types";
import { colors, radius, spacing } from "@/shared/theme/tokens";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { CachedImage } from "@/shared/ui/CachedImage";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

const icons = {
  user: require("../../../../assets/home/h_user.svg"),
  id: require("../../../../assets/home/h_id.svg"),
};

export function ClubCard({ club, onSelect }: { club: Club; onSelect?: (club: Club) => void }) {
  const colors = ["#24354b", "#4a2637", "#2e4650", "#493e2e"];
  const hue = colors[Number(club.id.match(/\d+$/)?.[0] ?? 0) % 4];
  const handlePress = () => {
    onSelect?.(club);
    router.push({ pathname: "/club/[id]", params: { id: club.id } });
  };

  return (
    <Pressable
      accessibilityLabel={`查看${club.name}详情`}
      style={styles.club}
      onPress={handlePress}
    >
      <View style={[styles.cover, { backgroundColor: hue }]}>
        {club.coverUrl ? (
          <CachedImage
            source={{ uri: club.coverUrl }}
            style={styles.coverImage}
            contentFit="cover"
          />
        ) : (
          <Text style={styles.coverText}>{club.name.slice(0, 1)}</Text>
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          {club.isSelfOperated && <Text style={styles.self}>自营</Text>}
          <Text numberOfLines={1} style={styles.name}>
            {club.name}
          </Text>
          {/* <Text style={styles.online}>• {club.onlineCount}人</Text> */}
        </View>
        <Text numberOfLines={2} style={styles.desc}>
          {club.description}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <Image source={icons.user} style={styles.metaIcon} />
            <Text style={styles.metaText}>{club.memberCount}人</Text>
          </View>
          <View style={styles.meta}>
            <Image source={icons.id} style={styles.metaIcon} />
            <Text style={styles.metaText}>{club.clubCode}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  club: {
    minHeight: 104,
    marginHorizontal: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
  },
  cover: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  coverText: {
    fontFamily: DOUYIN_SANS,
    color: "rgba(255,255,255,.78)",
    fontSize: 34,
    fontWeight: "800",
  },
  coverImage: { width: "100%", height: "100%", borderRadius: radius.md },
  body: { flex: 1, paddingTop: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 22,
  },
  self: {
    fontFamily: DOUYIN_SANS,
    color: colors.surface,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 10,
    fontWeight: "700",
  },
  name: {
    fontFamily: DOUYIN_SANS,
    color: "#0a0a0a",
    fontSize: 14,
    fontWeight: "500",
    flexShrink: 1,
  },
  online: { fontFamily: DOUYIN_SANS, color: "#2fc273", fontSize: 12 },
  desc: {
    fontFamily: DOUYIN_SANS,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  meta: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: {
    fontFamily: DOUYIN_SANS,
    color: "#999",
    fontSize: 11,
    lineHeight: 14,
  },
  metaIcon: { width: 12, height: 12 },
});
