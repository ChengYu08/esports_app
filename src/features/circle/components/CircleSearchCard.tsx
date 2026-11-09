import { Image } from "expo-image";
import { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { CircleVideoPost } from "@/features/circle/circle-data";
import { formatCircleCount } from "@/features/circle/circle-data";
import { CircleCommentHeartIcon } from "@/features/circle/components/CircleActionIcons";
import { SYSTEM_FONT } from "@/shared/theme/typography";

/** 封面宽高比夹在设计稿两种比例之间（4:3 ≈ 0.6，3:4 ≈ 1.333）。 */
const MIN_COVER_ASPECT = 0.6;
const MAX_COVER_ASPECT = 4 / 3;
const DEFAULT_COVER_ASPECT = 4 / 3;

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) {
    return "";
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/** 搜索瀑布流视频卡片，按 Figma「搜索结果页」还原。 */
export const CircleSearchCard = memo(function CircleSearchCard({
  post,
  onPress,
}: {
  post: CircleVideoPost;
  onPress: (post: CircleVideoPost) => void;
}) {
  // 封面真实宽高比加载后才可知，先按 3:4 占位，onLoad 后夹紧到设计范围
  const [coverAspect, setCoverAspect] = useState(DEFAULT_COVER_ASPECT);
  const duration = formatDuration(post.durationSec);
  const title = post.headline ?? post.content;
  const nickname = post.author.replace(/^@/, "");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        onPress(post);
      }}
      style={styles.card}
    >
      <View style={styles.coverWrap}>
        <Image
          source={post.cover}
          style={[styles.cover, { aspectRatio: coverAspect }]}
          contentFit="cover"
          onLoad={(event) => {
            const source = event.source as { width?: number; height?: number };
            if (!source.width || !source.height) {
              return;
            }
            const aspect = source.width / source.height;
            const next = Math.min(Math.max(aspect, MIN_COVER_ASPECT), MAX_COVER_ASPECT);
            if (Math.abs(next - coverAspect) > 0.01) {
              setCoverAspect(next);
            }
          }}
        />
        {duration ? (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.metaRow}>
          <Image source={post.avatar} style={styles.avatar} contentFit="cover" />
          <View style={styles.authorColumn}>
            <Text style={styles.nickname} numberOfLines={1}>
              {nickname}
            </Text>
            <Text style={styles.publishTime} numberOfLines={1}>
              {post.publishedAt}
            </Text>
          </View>
          <View style={styles.likeRow}>
            <CircleCommentHeartIcon
              filled={Boolean(post.liked)}
              color={post.liked ? "#FE1F4C" : "#656566"}
            />
            <Text style={styles.likeCount}>{formatCircleCount(post.likeCount)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  coverWrap: { position: "relative" },
  cover: { width: "100%", backgroundColor: "#F0F1F2" },
  durationBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 27,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  durationText: {
    fontFamily: SYSTEM_FONT,
    color: "#FFFFFF",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "400",
  },
  body: { padding: 8, gap: 8 },
  title: {
    fontFamily: SYSTEM_FONT,
    color: "#0D0D0F",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "400",
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFFFFF",
    backgroundColor: "#F0F1F2",
  },
  authorColumn: { flex: 1, justifyContent: "center", gap: 1 },
  nickname: {
    fontFamily: SYSTEM_FONT,
    color: "#656566",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "400",
  },
  publishTime: {
    fontFamily: SYSTEM_FONT,
    color: "#979799",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "400",
  },
  likeRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  likeCount: {
    fontFamily: SYSTEM_FONT,
    color: "#656566",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "400",
  },
});
