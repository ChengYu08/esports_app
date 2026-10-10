import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  readBlacklist,
  removeFromBlacklist,
  type BlacklistEntry,
} from "@/features/mine/blacklist";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");

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
    await removeFromBlacklist(userId);
    setEntries((current) => current.filter((entry) => entry.userId !== userId));
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { height: 44 + insets.top, paddingTop: insets.top }]}>
        <Pressable accessibilityLabel="返回" hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <Image source={backIcon} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>黑名单</Text>
        <View style={styles.headerSpace} />
      </View>
      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>暂无黑名单用户</Text>
          <Text style={styles.emptyHint}>你拉黑的用户会显示在这里</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {entries.map((entry) => (
            <BlacklistRow key={entry.userId} entry={entry} onRemove={removeEntry} />
          ))}
        </View>
      )}
    </View>
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
  const [translateX] = useState(() => new Animated.Value(0));
  const opened = useRef(false);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 8 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_, gestureState) => {
          const nextX = opened.current
            ? Math.min(
                0,
                Math.max(
                  -REMOVE_ACTION_WIDTH,
                  gestureState.dx - REMOVE_ACTION_WIDTH,
                ),
              )
            : Math.min(0, Math.max(-REMOVE_ACTION_WIDTH, gestureState.dx));
          translateX.setValue(nextX);
        },
        onPanResponderRelease: (_, gestureState) => {
          const currentX = opened.current
            ? gestureState.dx - REMOVE_ACTION_WIDTH
            : gestureState.dx;
          const shouldOpen = currentX < -REMOVE_ACTION_WIDTH / 2;
          opened.current = shouldOpen;
          Animated.spring(translateX, {
            toValue: shouldOpen ? -REMOVE_ACTION_WIDTH : 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
        onPanResponderTerminate: () => {
          opened.current = false;
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
      }),
    [translateX],
  );

  return (
    <View style={styles.rowClip}>
      <Pressable
        accessibilityLabel={`移除${entry.nickname}出黑名单`}
        accessibilityRole="button"
        onPress={() => onRemove(entry.userId)}
        style={styles.removeButton}
      >
        <Text style={styles.removeText}>移除</Text>
      </Pressable>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.row, { transform: [{ translateX }] }]}
      >
        <Image
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
      </Animated.View>
    </View>
  );
}

const fallbackAvatar = require("../../../../assets/mine/figma/profile-avatar.png");

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  header: { backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EBEBEB" },
  backButton: { width: 28, height: 28, justifyContent: "center" },
  backIcon: { width: 24, height: 24, tintColor: "#0A0A0A" },
  headerSpace: { width: 28 },
  headerTitle: { color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 17, lineHeight: 24, fontWeight: "600" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 },
  emptyTitle: { color: "#333", fontFamily: DOUYIN_SANS, fontSize: 16 },
  emptyHint: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 13, marginTop: 8 },
  list: { paddingTop: 12 },
  rowClip: {
    height: 76,
    marginBottom: 1,
    overflow: "hidden",
    backgroundColor: "#FF3158",
  },
  row: {
    height: 76,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#EEE" },
  copy: { flex: 1, minWidth: 0, marginLeft: 12, gap: 5 },
  nickname: { color: "#222", fontFamily: DOUYIN_SANS, fontSize: 16, fontWeight: "600" },
  clubName: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 13 },
  removeButton: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: REMOVE_ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF3158",
  },
  removeText: { color: "#FFF", fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "600" },
});
