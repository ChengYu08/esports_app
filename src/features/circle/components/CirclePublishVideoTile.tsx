import {
  Dismiss16Regular,
  Play32Regular,
} from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { VideoPickResult } from "@/shared/media-picker/media-picker-session";
import { SYSTEM_FONT } from "@/shared/theme/typography";

const addIcon = require("../../../../assets/svgs/circle-publish-add.svg");

export type UploadState = {
  status: "uploading" | "success" | "failed";
  percent: number;
  vid?: string;
};

type CirclePublishVideoTileProps = {
  video: VideoPickResult | null;
  coverUri: string | null;
  upload: UploadState | null;
  onPick: () => void;
  onRemove: () => void;
  onRetry: () => void;
};

/** 发视频页的“添加视频”瓦片：未选择 → 点选视频；已选择 → 封面+播放角标+删除，叠加上传进度/失败重试遮罩。 */
export function CirclePublishVideoTile({
  video,
  coverUri,
  upload,
  onPick,
  onRemove,
  onRetry,
}: CirclePublishVideoTileProps) {
  const handlePress = () => {
    if (upload?.status === "failed") {
      onRetry();
      return;
    }
    if (!video) {
      onPick();
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="选择视频"
      style={styles.tile}
      onPress={handlePress}
    >
      {video ? (
        <View style={styles.inner}>
          {coverUri ? (
            <Image
              source={{ uri: coverUri }}
              style={styles.cover}
              contentFit="cover"
            />
          ) : (
            <View style={styles.coverPlaceholder} />
          )}
          <View pointerEvents="none" style={styles.playWrap}>
            <Play32Regular color="#FFFFFF" width={32} height={32} />
          </View>
          {upload?.status === "uploading" ? (
            <View style={styles.progress}>
              <Text style={styles.progressText}>{upload.percent}%</Text>
            </View>
          ) : null}
          {upload?.status === "failed" ? (
            <View style={styles.progress}>
              <Text style={styles.progressText}>点击重试</Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="移除视频"
            hitSlop={12}
            onPress={onRemove}
            style={styles.delete}
          >
            <Dismiss16Regular color="#FFFFFF" width={12} height={12} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.empty}>
          <Image source={addIcon} style={styles.addIcon} />
          <Text style={styles.emptyText}>添加视频</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 96,
    height: 96,
    borderRadius: 8,
    backgroundColor: "#F5F6F7",
    overflow: "hidden",
    marginBottom: 12,
  },
  inner: {
    width: "100%",
    height: "100%",
  },
  cover: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1A1A1A",
  },
  coverPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1A1A1A",
  },
  playWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  delete: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  progress: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  progressText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    color: "#FFFFFF",
  },
  empty: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addIcon: {
    width: 40,
    height: 40,
  },
  emptyText: {
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    color: "#CACACC",
  },
});
