import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showToast } from "@/shared/ui/app-toast";
import { useAuthStore } from "@esports/auth";

import {
  readBlacklist,
  removeFromBlacklist,
  type BlacklistEntry,
} from "@/features/mine/blacklist";
import { EmptyState } from "@/shared/ui/AsyncStates";
import { CachedImage } from "@/shared/ui/CachedImage";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { requireLogin } from "@/shared/navigation/require-login";

export default function BlacklistScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);

  useEffect(() => {
    let active = true;
    void readBlacklist().then((value) => {
      if (active) setEntries(value);
    });
    return () => {
      active = false;
    };
  }, []);

  const removeEntry = async (userId: string) => {
    if (!requireLogin()) return;
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    try {
      await removeFromBlacklist(userId, token);
      setEntries((current) => current.filter((entry) => entry.userId !== userId));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "操作失败");
    }
  };

  return (
    <GestureHandlerRootView style={styles.screen}>
      <ScreenHeader
        title="黑名单"
        onBack={() => router.back()}
        titleStyle={styles.headerTitle}
        style={{
          paddingTop: insets.top,
          height: insets.top + 44,
          paddingHorizontal: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: "#EBEBEB",
        }}
      />
      {entries.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState
            message="暂无黑名单用户"
            hint="你拉黑的用户会显示在这里"
          />
        </View>
      ) : (
        <View style={styles.list}>
          {entries.map((entry) => (
            <BlacklistRow
              key={entry.userId}
              entry={entry}
              onRemove={removeEntry}
            />
          ))}
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const REMOVE_ACTION_WIDTH = 88;

function BlacklistRow({
  entry,
  onRemove,
}: {
  entry: BlacklistEntry;
  onRemove: (userId: string) => void;
}) {
  return (
    <View style={styles.rowClip}>
      <Swipeable
        containerStyle={styles.swipeable}
        overshootRight={false}
        renderRightActions={() => (
          <Pressable
            accessibilityLabel={`移除${entry.nickname}出黑名单`}
            accessibilityRole="button"
            onPress={() => onRemove(entry.userId)}
            style={styles.removeButton}
          >
            <Text style={styles.removeText}>移除</Text>
          </Pressable>
        )}
        rightThreshold={REMOVE_ACTION_WIDTH / 2}
      >
        <View style={styles.row}>
          <CachedImage
            source={entry.headImage ? { uri: entry.headImage } : fallbackAvatar}
            style={styles.avatar}
            contentFit="cover"
          />
          <View style={styles.copy}>
            <Text numberOfLines={1} style={styles.nickname}>
              {entry.nickname || "未命名用户"}
            </Text>
            {entry.clubName ? (
              <Text numberOfLines={1} style={styles.clubName}>
                {entry.clubName}
              </Text>
            ) : null}
          </View>
        </View>
      </Swipeable>
    </View>
  );
}

const fallbackAvatar = require("../../../../assets/mine/mine-avatar.png");

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  headerTitle: {
    color: "#0A0A0A",
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },
  list: { paddingTop: 12 },
  rowClip: {
    height: 76,
    marginBottom: 1,
    overflow: "hidden",
    backgroundColor: "#FF3158",
  },
  row: {
    width: "100%",
    height: 76,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#EEE" },
  copy: { flex: 1, minWidth: 0, marginLeft: 12, gap: 5 },
  nickname: {
    color: "#222",
    fontSize: 16,
    fontWeight: "600",
  },
  clubName: { color: "#999", fontSize: 13 },
  removeButton: {
    width: REMOVE_ACTION_WIDTH,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF3158",
  },
  swipeable: { height: 76, backgroundColor: "#FF3158" },
  removeText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
