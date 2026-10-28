import {
  CaretDown16Regular,
  Dismiss24Regular,
} from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library/legacy";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import { completeAvatarEdit } from "@/features/mine/utils/avatar-edit-session";

type MediaAsset = MediaLibrary.Asset;

type AlbumOption = {
  id: string; // 空串代表“最近项目”（全部照片）
  name: string;
};

const PAGE_SIZE = 60;

export default function AvatarAlbumScreen() {
  const insets = useSafeAreaInsets();
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

  const requestPermission = useCallback(async () => {
    const response = await MediaLibrary.requestPermissionsAsync();
    setPermission(response);
    return response.granted;
  }, []);

  const loadPage = useCallback(
    async (album: AlbumOption, after?: string) => {
      if (loading) return;
      setLoading(true);
      try {
        const page = await MediaLibrary.getAssetsAsync({
          mediaType: ["photo"],
          first: PAGE_SIZE,
          sortBy: [["creationTime", false]],
          ...(album.id ? { album: album.id } : {}),
          ...(after ? { after } : {}),
        });
        setAssets((current) =>
          after ? [...current, ...page.assets] : page.assets,
        );
        setEndCursor(page.endCursor);
        setHasNextPage(page.hasNextPage);
      } finally {
        setLoading(false);
      }
    },
    [loading],
  );

  // 初始化：权限 → 最近项目 + 相册下拉数据
  useEffect(() => {
    void (async () => {
      const granted = await requestPermission();
      if (!granted) return;
      await loadPage(activeAlbum);
      const list = await MediaLibrary.getAlbumsAsync({
        includeSmartAlbums: true,
      });
      setAlbums(
        list
          .filter((album) => album.assetCount > 0)
          .map((album) => ({
            id: album.id,
            name: album.title,
          })),
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchAlbum = (album: AlbumOption) => {
    setAlbumsOpen(false);
    if (album.id === activeAlbum.id) return;
    setActiveAlbum(album);
    setAssets([]);
    setEndCursor(null);
    void loadPage(album);
  };

  const close = () => {
    completeAvatarEdit(null);
    router.back();
  };

  // iOS 的 ph:// 无法直接裁剪，先换取本地文件路径
  const openCrop = async (asset: MediaAsset) => {
    let uri = asset.uri;
    if (uri.startsWith("ph://")) {
      const info = await MediaLibrary.getAssetInfoAsync(asset);
      uri = info.localUri ?? uri;
    }
    router.push({
      pathname: "/avatar-crop",
      params: {
        uri,
        width: String(asset.width),
        height: String(asset.height),
      },
    });
  };

  if (permission && !permission.granted) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Dismiss24Regular color="#333333" width={24} height={24} />
        <Text style={styles.deniedText}>
          没有访问照片的权限，请在系统设置中允许访问照片后重试。
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void requestPermission()}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>重新授权</Text>
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
        <View style={styles.navPlaceholder} />
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
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="选择照片"
            onPress={() => void openCrop(item)}
            style={styles.gridItem}
          >
            <Image
              source={{ uri: item.uri }}
              style={styles.thumb}
              contentFit="cover"
              transition={0}
              recyclingKey={item.id}
            />
          </Pressable>
        )}
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
