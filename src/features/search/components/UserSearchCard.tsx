import { Image } from "expo-image";
import { router } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { calculateAge } from "@/features/mine/profile-utils";
import { colors, spacing } from "@/shared/theme/tokens";
import { CachedImage } from "@/shared/ui/CachedImage";
import type { SearchUser } from "../api/search.api";
import { useSearchUserProfile } from "../hooks/use-user-search";
import { getSearchUserStatus } from "../search-user-status";
import { searchTypography } from "../search-typography";
import { HighlightedSearchText, SearchResultId } from "./SearchResultText";

const maleIcon = require("../../../../assets/home/club-detail/male.svg");
const femaleIcon = require("../../../../assets/mine/figma/mine-female.svg");
const idleIcon = require("../../../../assets/search/status-idle.svg");
const playingIcon = require("../../../../assets/search/status-playing.svg");

export const UserSearchCard = memo(function UserSearchCard({
  user,
  keyword,
  clubId,
  onSelect,
}: {
  user: SearchUser;
  keyword: string;
  clubId?: string;
  onSelect?: (user: SearchUser) => void;
}) {
  const { data: profile } = useSearchUserProfile(user);
  const userId = String(user.userId);
  const matchesUserId = /^\d+$/.test(keyword) && userId.includes(keyword);
  const birth = user.birth || profile?.birth;
  const age = birth ? calculateAge(birth) : "";
  const sex = user.sex ?? profile?.sex;
  const genderColor = sex === 2 ? "#FF4D70" : "#0095EE";
  const status = getSearchUserStatus(
    user.onlineStatus ?? profile?.onlineStatus,
    user.gameStatus ?? profile?.gameStatus,
  );
  const statusLabel = status === "playing" ? "游戏中" : "空闲中";

  const openProfile = () => {
    onSelect?.(user);
    const targetClubId = user.clubId > 0 ? String(user.clubId) : clubId;
    router.push({
      pathname: "/profile",
      params: {
        userId,
        ...(targetClubId ? { clubId: targetClubId } : {}),
      },
    });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看${user.nickname}的主页`}
      onPress={openProfile}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.avatar}>
        {user.headImage ? (
          <CachedImage
            contentFit="cover"
            source={{ uri: user.headImage }}
            style={styles.avatarImage}
          />
        ) : (
          <Text style={styles.avatarText}>{user.nickname.slice(0, 1)}</Text>
        )}
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <View style={styles.identity}>
            <HighlightedSearchText text={user.nickname} keyword={keyword} style={styles.name} />
            {sex === 1 || sex === 2 || age ? (
              <View style={styles.gender}>
                {sex === 1 || sex === 2 ? (
                  <Image source={sex === 1 ? maleIcon : femaleIcon} style={styles.genderIcon} />
                ) : null}
                {age ? (
                  <Text style={[styles.age, { color: sex === 1 || sex === 2 ? genderColor : colors.textSecondary }]}>
                    {age}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
          {status ? (
            <View
              accessibilityLabel={statusLabel}
              style={[styles.status, status === "playing" ? styles.playing : styles.idle]}
            >
              <Image source={status === "playing" ? playingIcon : idleIcon} style={styles.statusIcon} />
              <Text numberOfLines={1} style={[styles.statusText, status === "playing" ? styles.playingText : styles.idleText]}>
                {statusLabel}
              </Text>
            </View>
          ) : null}
        </View>
        {matchesUserId ? (
          <SearchResultId id={userId} keyword={keyword} />
        ) : (
          <Text numberOfLines={1} style={styles.signature}>
            {user.signature || "暂无个人简介"}
          </Text>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: "#F7F7F7" },
  avatar: {
    flexShrink: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EBEBEB",
    backgroundColor: "#EDEDED",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { ...searchTypography.avatar, color: colors.textMuted },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  identity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  name: {
    ...searchTypography.medium14,
    flexShrink: 1,
    color: "#0A0A0A",
  },
  gender: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 2 },
  genderIcon: { width: 12, height: 12 },
  age: searchTypography.medium12,
  status: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 16,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
  },
  idle: { backgroundColor: "#E6FAEF" },
  playing: { backgroundColor: "#FFF4EB" },
  statusIcon: { width: 10, height: 10 },
  statusText: searchTypography.medium10,
  idleText: { color: "#14A357" },
  playingText: { color: "#F5821D" },
  signature: { ...searchTypography.regular12, color: colors.textSecondary },
});
