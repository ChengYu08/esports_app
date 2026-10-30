import { useAuthStore } from "@esports/auth";
import { ChevronLeft24Regular, Person24Regular } from "@fluentui/react-native-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showToast } from "@/shared/ui/app-toast";

import {
  type UserFollowType,
  type UserFollowUser,
} from "@/features/mine/api/user-follow.api";
import {
  useToggleUserFollow,
  useUserFollowPage,
} from "@/features/mine/hooks/use-user-follow";
import { requireLogin } from "@/shared/navigation/require-login";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { CachedImage } from "@/shared/ui/CachedImage";
import { EmptyState, ErrorState } from "@/shared/ui/AsyncStates";

const fallbackAvatar = require("../../../../assets/coms/avatar_default.webp");

function isUnavailableUser(user: UserFollowUser) {
  return user.nickname === "账号被封禁" || user.nickname === "账号已注销";
}

export default function ProfileRelationScreen() {
  const insets = useSafeAreaInsets();
  const route = useLocalSearchParams<{
    userId?: string | string[];
    clubId?: string | string[];
    type?: string | string[];
  }>();
  const viewerUserId = useAuthStore((state) => state.user?.id);
  const userId = typeof route.userId === "string" ? route.userId : undefined;
  const clubId = typeof route.clubId === "string" ? route.clubId : undefined;
  const requestedType =
    typeof route.type === "string" ? route.type : route.type?.[0];
  const type: UserFollowType = requestedType === "fans" ? "fans" : "following";
  const query = useUserFollowPage(userId, type);
  const followMutation = useToggleUserFollow();
  const [followedBackIds, setFollowedBackIds] = useState<Set<string>>(
    () => new Set(),
  );
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  const openUserProfile = (user: UserFollowUser) => {
    router.push({
      pathname: "/profile",
      params: {
        userId: user.userId,
        ...((user.clubId || clubId)
          ? { clubId: user.clubId || clubId }
          : {}),
      },
    });
  };

  const openChat = (user: UserFollowUser) => {
    if (!requireLogin()) return;
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: user.userId,
        title: user.nickname,
        avatar: user.avatar || "",
        clubId: user.clubId || clubId || "",
      },
    });
  };

  const followBack = async (user: UserFollowUser) => {
    if (!requireLogin()) return;
    const session = useAuthStore.getState();
    if (!session.accessToken || !session.user) return;

    try {
      const result = await followMutation.mutateAsync({
        followUserId: user.userId,
        currentlyFollowed: false,
        token: session.accessToken,
        viewerUserId: session.user.id,
      });
      if (result.followed) {
        setFollowedBackIds((current) => new Set(current).add(user.userId));
        showToast("已回关");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "回关失败");
    }
  };

  const switchType = (nextType: UserFollowType) => {
    if (nextType === type || !userId) return;
    router.replace({
      pathname: "/profile-relations",
      params: {
        userId,
        type: nextType,
        ...(clubId ? { clubId } : {}),
      },
    });
  };

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          { height: 44 + insets.top, paddingTop: insets.top },
        ]}
      >
        <View style={styles.nav}>
          <Pressable
            accessibilityLabel="返回"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ChevronLeft24Regular color="#0A0A0A" width={24} height={24} style={styles.backIcon} />
          </Pressable>
          <View style={styles.tabBar}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: type === "following" }}
              onPress={() => switchType("following")}
              style={styles.tab}
            >
              <Text
                style={[
                  styles.tabText,
                  type === "following" && styles.tabTextActive,
                ]}
              >
                关注
              </Text>
              {type === "following" ? <View style={styles.tabIndicator} /> : null}
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: type === "fans" }}
              onPress={() => switchType("fans")}
              style={styles.tab}
            >
              <Text
                style={[styles.tabText, type === "fans" && styles.tabTextActive]}
              >
                粉丝
              </Text>
              {type === "fans" ? <View style={styles.tabIndicator} /> : null}
            </Pressable>
          </View>
          <View style={styles.headerSpace} />
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={[
          styles.listContent,
          items.length === 0 && styles.emptyContent,
        ]}
        renderItem={({ item }) => {
          const isSelf = Boolean(viewerUserId && item.userId === viewerUserId);
          const unavailable = isUnavailableUser(item);
          const followedBack =
            item.followedBack || followedBackIds.has(item.userId);
          const followPending =
            followMutation.isPending &&
            followMutation.variables?.followUserId === item.userId;

          return (
            <View style={styles.row}>
              <Pressable
                disabled={unavailable}
                accessibilityRole="button"
                accessibilityLabel={`查看${item.nickname}的主页`}
                onPress={unavailable ? undefined : () => openUserProfile(item)}
                style={({ pressed }) => [
                  styles.userInfo,
                  pressed && !unavailable && styles.pressed,
                ]}
              >
                <View style={styles.avatarFrame}>
                  {unavailable ? (
                    <View style={styles.unavailableAvatar}>
                      <Person24Regular color="#D9D9D9" height={24} width={24} />
                    </View>
                  ) : (
                    <CachedImage
                      source={item.avatar ? { uri: item.avatar } : fallbackAvatar}
                      contentFit="cover"
                      style={styles.avatar}
                    />
                  )}
                </View>
                <View style={styles.userCopy}>
                  <Text numberOfLines={1} style={styles.nickname}>
                    {item.nickname}
                  </Text>
                  {item.signature ? (
                    <Text numberOfLines={1} style={styles.signature}>
                      {item.signature}
                    </Text>
                  ) : null}
                </View>
              </Pressable>

              {!unavailable && !isSelf ? (
                <View style={styles.actions}>
                  {type === "fans" ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={followedBack ? "已回关" : "回关"}
                      accessibilityState={{
                        disabled: followedBack || followPending,
                        busy: followPending,
                      }}
                      disabled={followedBack || followPending}
                      onPress={() => void followBack(item)}
                      style={[
                        styles.actionButton,
                        followedBack && styles.actionButtonDone,
                      ]}
                    >
                      <Text
                        style={[
                          styles.actionText,
                          followedBack && styles.actionTextDone,
                        ]}
                      >
                        {followedBack ? "已回关" : "回关"}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="聊一聊"
                      onPress={() => openChat(item)}
                      style={styles.actionButton}
                    >
                      <Text style={styles.actionText}>聊一聊</Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
            </View>
          );
        }}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            void query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.35}
        onRefresh={() => void query.refetch()}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        ListEmptyComponent={
          query.isLoading ? (
            <ActivityIndicator style={styles.emptyLoading} color="#E62336" />
          ) : query.isError ? (
            <ErrorState
              message="列表加载失败"
              onRetry={() => void query.refetch()}
            />
          ) : (
            <EmptyState
              message={type === "fans" ? "还没有粉丝" : "还没有关注任何人"}
              style={styles.emptyState}
            />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator style={styles.footer} color="#E62336" />
          ) : query.isFetchNextPageError ? (
            <Pressable
              onPress={() => void query.fetchNextPage()}
              style={styles.footer}
            >
              <Text style={styles.retryText}>加载失败，点击重试</Text>
            </Pressable>
          ) : items.length > 0 && !query.hasNextPage ? (
            <Text style={styles.footerText}>没有更多了</Text>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { backgroundColor: "#FFFFFF" },
  nav: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 48,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { width: 24, height: 24 },
  tabBar: {
    flex: 1,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 36,
  },
  tab: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tabText: {
    color: "#999999",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
  },
  tabTextActive: {
    color: "#1A1A1A",
    fontWeight: "600",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 4,
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#E62336",
  },
  headerSpace: { width: 48, height: 44 },
  listContent: { paddingHorizontal: 16 },
  emptyContent: { flexGrow: 1 },
  row: {
    height: 76,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  userInfo: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" },
  pressed: { opacity: 0.75 },
  avatarFrame: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EBEBEB",
    backgroundColor: "#FFFFFF",
  },
  avatar: { width: 44, height: 44 },
  unavailableAvatar: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F2F2",
  },
  userCopy: { flex: 1, minWidth: 0, marginLeft: 8 },
  nickname: {
    flexShrink: 1,
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  signature: {
    marginTop: 0,
    color: "#666666",
    fontFamily: DOUYIN_SANS,
    fontSize: 11,
    lineHeight: 16,
  },
  actions: { alignItems: "center", justifyContent: "center", marginLeft: 16 },
  actionButton: {
    minWidth: 60,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EBEBEB",
    backgroundColor: "#FFFFFF",
  },
  actionButtonDone: { backgroundColor: "#F7F7F7" },
  actionText: {
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  actionTextDone: { color: "#999999" },
  emptyState: { flex: 1 },
  emptyLoading: { flex: 1, alignSelf: "center" },
  retryText: { color: "#E62336", fontFamily: DOUYIN_SANS, fontSize: 13 },
  footer: { alignItems: "center", paddingVertical: 20 },
  footerText: {
    paddingVertical: 20,
    color: "#BBBBBB",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    textAlign: "center",
  },
});
