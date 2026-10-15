import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
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
import Toast from "react-native-root-toast";

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

const fallbackAvatar = require("../../../../assets/mine/figma/mine-avatar.png");
const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");

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
  const type: UserFollowType = route.type === "fans" ? "fans" : "following";
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
        Toast.show("已回关", { duration: Toast.durations.SHORT });
      }
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : "回关失败", {
        duration: Toast.durations.SHORT,
      });
    }
  };

  const title = type === "fans" ? "粉丝" : "关注";

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          { height: 44 + insets.top, paddingTop: insets.top },
        ]}
      >
        <Pressable
          accessibilityLabel="返回"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Image source={backIcon} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpace} />
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
          const followedBack =
            item.followedBack || followedBackIds.has(item.userId);
          const followPending =
            followMutation.isPending &&
            followMutation.variables?.followUserId === item.userId;

          return (
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`查看${item.nickname}的主页`}
                onPress={() => openUserProfile(item)}
                style={({ pressed }) => [
                  styles.userInfo,
                  pressed && styles.pressed,
                ]}
              >
                <CachedImage
                  source={item.avatar ? { uri: item.avatar } : fallbackAvatar}
                  contentFit="cover"
                  style={styles.avatar}
                />
                <View style={styles.userCopy}>
                  <View style={styles.nameLine}>
                    <Text numberOfLines={1} style={styles.nickname}>
                      {item.nickname}
                    </Text>
                    {item.gender === 1 || item.gender === 2 ? (
                      <Text
                        style={[
                          styles.gender,
                          item.gender === 2 && styles.femaleGender,
                        ]}
                      >
                        {item.gender === 1 ? "男" : "女"}
                      </Text>
                    ) : null}
                    {item.age != null ? (
                      <Text style={styles.age}>{item.age}</Text>
                    ) : null}
                  </View>
                  <Text numberOfLines={1} style={styles.signature}>
                    {item.signature || "暂无个性签名"}
                  </Text>
                  <Text numberOfLines={1} style={styles.userId}>
                    ID：{item.userId}
                  </Text>
                </View>
              </Pressable>

              <View style={styles.actions}>
                {type === "fans" && !isSelf ? (
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
                      {followedBack
                        ? "已回关"
                        : followPending
                          ? "处理中…"
                          : "回关"}
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => openUserProfile(item)}
                      style={styles.profileButton}
                    >
                      <Text style={styles.profileButtonText}>主页</Text>
                    </Pressable>
                    {!isSelf ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => openChat(item)}
                        style={styles.chatButton}
                      >
                        <Text style={styles.chatButtonText}>聊一聊</Text>
                      </Pressable>
                    ) : null}
                  </>
                )}
              </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0F0F0",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 48,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { width: 24, height: 24, tintColor: "#0A0A0A" },
  headerTitle: {
    color: "#111111",
    fontFamily: DOUYIN_SANS,
    fontSize: 17,
    fontWeight: "600",
  },
  headerSpace: { width: 48, height: 44 },
  listContent: { paddingHorizontal: 16 },
  emptyContent: { flexGrow: 1 },
  row: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEEEEE",
  },
  userInfo: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" },
  pressed: { opacity: 0.75 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#F2F2F2" },
  userCopy: { flex: 1, minWidth: 0, marginLeft: 12 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  nickname: {
    flexShrink: 1,
    color: "#222222",
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
    fontWeight: "600",
  },
  gender: {
    overflow: "hidden",
    borderRadius: 4,
    paddingHorizontal: 4,
    color: "#2878FF",
    backgroundColor: "#E9F2FF",
    fontFamily: DOUYIN_SANS,
    fontSize: 10,
    lineHeight: 16,
  },
  femaleGender: { color: "#F04E85", backgroundColor: "#FFF0F5" },
  age: {
    color: "#555555",
    backgroundColor: "#F1F1F1",
    overflow: "hidden",
    borderRadius: 4,
    paddingHorizontal: 4,
    fontFamily: DOUYIN_SANS,
    fontSize: 10,
    lineHeight: 16,
  },
  signature: {
    marginTop: 4,
    color: "#888888",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
  },
  userId: {
    marginTop: 2,
    color: "#AAAAAA",
    fontFamily: DOUYIN_SANS,
    fontSize: 11,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 10 },
  actionButton: {
    minWidth: 62,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: "#E62336",
  },
  actionButtonDone: { backgroundColor: "#F3F3F3" },
  actionText: { color: "#FFFFFF", fontFamily: DOUYIN_SANS, fontSize: 12 },
  actionTextDone: { color: "#888888" },
  profileButton: {
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: "#F3F3F3",
  },
  profileButtonText: { color: "#555555", fontFamily: DOUYIN_SANS, fontSize: 12 },
  chatButton: {
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: "#E62336",
  },
  chatButtonText: { color: "#FFFFFF", fontFamily: DOUYIN_SANS, fontSize: 12 },
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
