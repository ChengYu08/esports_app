import {
  CaretDown16Regular,
  Dismiss24Regular,
  Checkmark24Regular,
} from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library/legacy";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showToast } from "@/shared/ui/app-toast";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import {
  completeMediaPick,
  isMediaPickActive,
} from "@/shared/media-picker/media-picker-session";

type MediaAsset = MediaLibrary.Asset;

type AlbumOption = {
  id: string; // 空串代表“最近项目”（全部照片）
  name: string;
};

const PAGE_SIZE = 60;

/** iOS 的 ph:// 无法直接读取/裁剪，先换取本地文件路径 */
async function resolveLocalUri(asset: MediaAsset): Promise<string> {
  if (!asset.uri.startsWith("ph://")) {
    return asset.uri;
  }
  const info = await MediaLibrary.getAssetInfoAsync(asset);
  return info.localUri ?? asset.uri;
}

export default function MediaPickerScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ max?: string; crop?: string }>();
  const maxCount = useMemo(() => {
    const parsed = Number(Array.isArray(params.max) ? params.max[0] : params.max);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  }, [params.max]);
  // 头像流程：单选后进入裁剪页，由裁剪页回传结果
  const cropEnabled =
    maxCount === 1 &&
    (Array.isArray(params.crop) ? params.crop[0] : params.crop) === "1";

  const [permission, setPermission] = useState<MediaLibrary.PermissionResponse | null>(
    null,
  );
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [albums, setAlbums] = useState<AlbumOption[]>([]);
  const [activeAlbum, setActiveAlbum] = useState<AlbumOption>({
    id: "",
    name: "最近项目",
  });
  const [albumsOpen, setAlbumsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // 请求序号：递增使过期响应失效，避免切相册竞态与双触发重复追加
  const requestSeq = useRef(0);
  const completingRef = useRef(false);

  const requestPermission = useCallback(async () => {
    // 只申请图片粒度权限（不申请音频/视频，保持权限最小化）
    const response = await MediaLibrary.requestPermissionsAsync(false, [
      "photo",
    ]);
    setPermission(response);
    return response.granted;
  }, []);

  const loadPage = useCallback(async (album: AlbumOption, after?: string) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const page = await MediaLibrary.getAssetsAsync({
        mediaType: ["photo"],
        first: PAGE_SIZE,
        sortBy: [["creationTime", false]],
        ...(album.id ? { album: album.id } : {}),
        ...(after ? { after } : {}),
      });
      // 过期响应（期间又发起了新请求）直接丢弃
      if (seq !== requestSeq.current) return;
      setAssets((current) =>
        after ? [...current, ...page.assets] : page.assets,
      );
      setEndCursor(page.endCursor);
      setHasNextPage(page.hasNextPage);
    } catch {
      if (seq === requestSeq.current) {
        showToast("照片加载失败，请稍后重试");
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, []);

  // 初始化：权限 → 最近项目 + 相册下拉数据
  useEffect(() => {
    void (async () => {
      const granted = await requestPermission();
      if (!granted) {
        return;
      }
      try {
        await loadPage(activeAlbum);
        const list = await MediaLibrary.getAlbumsAsync({
          includeSmartAlbums: true,
        });
        setAlbums(
          list
            .filter((album) => album.assetCount > 0 && album.title !== "最近项目")
            .map((album) => ({
              id: album.id,
              name: album.title,
            })),
        );
      } catch {
        showToast("照片读取失败，请检查相册权限后重试");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 手势/物理返回键兜底：终结会话，避免调用方页面悬挂
  useEffect(() => {
    return () => {
      if (isMediaPickActive()) {
        completeMediaPick(null);
      }
    };
  }, []);

  // 裁剪页被手势/物理返回键关闭时，会话已被裁剪页兜底终结；本页恢复可交互状态
  useFocusEffect(
    useCallback(() => {
      if (!isMediaPickActive()) {
        completingRef.current = false;
      }
    }, []),
  );

  const switchAlbum = (album: AlbumOption) => {
    setAlbumsOpen(false);
    if (album.id === activeAlbum.id) {
      return;
    }
    setActiveAlbum(album);
    setAssets([]);
    setEndCursor(null);
    setSelectedIds(new Set());
    void loadPage(album);
  };

  const close = () => {
    if (completingRef.current) {
      return;
    }
    completingRef.current = true;
    completeMediaPick(null);
    router.back();
  };

  const complete = async (picked: MediaAsset[]) => {
    if (completingRef.current || !picked.length) {
      return;
    }
    completingRef.current = true;
    try {
      const uris = await Promise.all(picked.map((asset) => resolveLocalUri(asset)));
      completeMediaPick(uris);
    } catch {
      completingRef.current = false;
      showToast("照片读取失败，请稍后重试");
      return;
    }
    router.back();
  };

  // 头像流程：进入裁剪页，裁剪结果由裁剪页回传
  const openCrop = async (asset: MediaAsset) => {
    if (completingRef.current) {
      return;
    }
    completingRef.current = true;
    try {
      const uri = await resolveLocalUri(asset);
      router.push({
        pathname: "/avatar-crop",
        params: {
          uri,
          width: String(asset.width),
          height: String(asset.height),
        },
      });
    } catch {
      completingRef.current = false;
      showToast("照片读取失败，请稍后重试");
    }
  };

  const toggleSelect = (asset: MediaAsset) => {
    if (completingRef.current) {
      return;
    }
    if (cropEnabled) {
      void openCrop(asset);
      return;
    }
    if (maxCount === 1) {
      void complete([asset]);
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(asset.id)) {
        next.delete(asset.id);
      } else if (next.size >= maxCount) {
        showToast(`最多选择${maxCount}张`);
        return current;
      } else {
        next.add(asset.id);
      }
      return next;
    });
  };

  const confirmMultiSelect = () => {
    const picked = assets.filter((asset) => selectedIds.has(asset.id));
    void complete(picked);
  };

  if (permission && !permission.granted) {
    // 已判定拒绝且系统不再弹框时，只能引导用户去系统设置开启
    const goSettings = !permission.canAskAgain;
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Dismiss24Regular color="#333333" width={24} height={24} />
        <Text style={styles.deniedText}>
          {goSettings
            ? "相册访问权限已被拒绝，请前往系统设置开启后重试。"
            : "没有访问照片的权限，需要允许访问照片后才能选择。"}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (goSettings) {
              void Linking.openSettings();
            } else {
              void requestPermission();
            }
          }}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>
            {goSettings ? "去设置开启" : "重新授权"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭"
          onPress={close}
          style={[styles.retryButton, styles.closeButton]}
        >
          <Text style={styles.retryText}>关闭</Text>
        </Pressable>
      </View>
    );
  }

  const selectedCount = selectedIds.size;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.navbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭"
          hitSlop={8}
          onPress={close}
          style={styles.navButton}
        >
          <Dismiss24Regular color="#333333" width={24} height={24} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="选择相册"
          onPress={() => setAlbumsOpen((open) => !open)}
          style={styles.titleButton}
        >
          <Text numberOfLines={1} style={styles.titleText}>
            {activeAlbum.name}
          </Text>
          <CaretDown16Regular color="#333333" width={16} height={16} />
        </Pressable>
        {maxCount > 1 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="确认选择"
            disabled={selectedCount === 0}
            onPress={confirmMultiSelect}
            style={[
              styles.confirmButton,
              selectedCount === 0 && styles.confirmButtonDisabled,
            ]}
          >
            <Text style={styles.confirmText}>
              {selectedCount > 0 ? `完成(${selectedCount}/${maxCount})` : "完成"}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.navPlaceholder} />
        )}
      </View>

      {albumsOpen ? (
        <View
          style={[
            styles.albumsPanel,
            { top: insets.top + 44 },
          ]}
        >
          <FlatList
            data={[{ id: "", name: "最近项目" }, ...albums]}
            keyExtractor={(item) => item.id || "recent"}
            style={styles.albumsList}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => switchAlbum(item)}
                style={styles.albumRow}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.albumName,
                    item.id === activeAlbum.id && styles.albumNameActive,
                  ]}
                >
                  {item.name}
                </Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      <FlatList
        data={assets}
        numColumns={4}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const selected = selectedIds.has(item.id);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="选择照片"
              onPress={() => toggleSelect(item)}
              style={styles.gridItem}
            >
              <Image
                source={{ uri: item.uri }}
                style={styles.thumb}
                contentFit="cover"
                transition={0}
                recyclingKey={item.id}
              />
              {maxCount > 1 && selected ? (
                <View style={styles.checkOverlay}>
                  <Checkmark24Regular color="#FFFFFF" width={18} height={18} />
                </View>
              ) : null}
            </Pressable>
          );
        }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && endCursor && !loading) {
            void loadPage(activeAlbum, endCursor);
          }
        }}
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.emptyText}>相册中没有照片</Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  navbar: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  navButton: {
    width: 32,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  titleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  titleText: {
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    maxWidth: 200,
  },
  navPlaceholder: { width: 32 },
  confirmButton: {
    minWidth: 32,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#FE1F4C",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonDisabled: {
    backgroundColor: "#F5F5F5",
  },
  confirmText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    fontWeight: "600",
  },
  albumsPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    elevation: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  albumsList: { maxHeight: 320 },
  albumRow: {
    height: 48,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  albumName: {
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
  },
  albumNameActive: {
    color: "#FE1F4C",
    fontWeight: "600",
  },
  gridItem: {
    width: "25%",
    aspectRatio: 1,
    padding: 0.5,
  },
  thumb: { width: "100%", height: "100%", backgroundColor: "#F0F0F0" },
  checkOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(254, 31, 76, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    marginTop: 80,
    alignSelf: "center",
    color: "#999999",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
  },
  deniedText: {
    marginTop: 16,
    textAlign: "center",
    color: "#666666",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 16,
    height: 42,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: "#FE1F4C",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
    backgroundColor: "#F5F5F5",
  },
  retryText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
  },
});
