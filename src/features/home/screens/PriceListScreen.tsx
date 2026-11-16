import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePriceList } from "../hooks/use-home-data";
import { createImagePreviewParams } from "@/features/mine/image-preview.params";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncStates";
import { CachedImage } from "@/shared/ui/CachedImage";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";

export default function PriceListScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const query = usePriceList(groupId);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visitedTabs, setVisitedTabs] = useState<number[]>([0]);
  const contentRef = useRef<ScrollView>(null);
  const tabs = useMemo(() => query.data ?? [], [query.data]);
  const activeIndex = selectedIndex < tabs.length ? selectedIndex : 0;
  const selectedTab = tabs[activeIndex];

  useEffect(() => {
    if (tabs.length === 0) {
      return;
    }

    // 提前缓存图片，切换分类时减少等待。
    Image.prefetch(tabs.flatMap((tab) => tab.imageUrls), "memory-disk");
  }, [tabs]);

  const content = useMemo(() => {
    if (query.isLoading) return <LoadingState />;
    if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
    if (!selectedTab) return <EmptyState message="暂无价目表" />;
    return (
      <>
        {tabs.map((tab, tabIndex) => {
          if (!visitedTabs.includes(tabIndex) && tabIndex !== activeIndex) {
            return null;
          }
          const hidden = tabIndex !== activeIndex;
          return (
            <View key={`${tab.menuTitle}-${tab.sortNo}-${tabIndex}`} style={[styles.images, hidden && styles.hidden]} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}>
              {tab.imageUrls.map((uri, index) => (
                <PriceImage
                  key={`${uri}-${index}`}
                  uri={uri}
                  width={width}
                  onPress={() => {
                    router.push({
                      pathname: "/image-preview",
                      params: createImagePreviewParams(tab.imageUrls, index),
                    });
                  }}
                />
              ))}
            </View>
          );
        })}
      </>
    );
  }, [activeIndex, query, selectedTab, tabs, visitedTabs, width]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="价目表"
        onBack={() => router.back()}
        titleStyle={styles.navTitle}
        style={{ paddingTop: insets.top, height: insets.top + 44 }}
      />
      {tabs.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
          {tabs.map((tab, index) => (
            <Pressable key={`${tab.menuTitle}-${tab.sortNo}`} onPress={() => {
              setVisitedTabs((current) => current.includes(index) ? current : [...current, index]);
              setSelectedIndex(index);
              contentRef.current?.scrollTo({ y: 0, animated: false });
            }} style={styles.tab}>
              <Text numberOfLines={1} style={[styles.tabText, index === activeIndex && styles.tabTextActive]}>{tab.menuTitle}</Text>
              {index === activeIndex && <View style={styles.tabIndicator} />}
            </Pressable>
          ))}
        </ScrollView>
      )}
      <ScrollView ref={contentRef} showsVerticalScrollIndicator={false} style={styles.content} contentContainerStyle={styles.contentContainer}>
        {content}
      </ScrollView>
    </View>
  );
}

// 按 uri 缓存已量到的宽高比，tab 切换重挂载时直接用真实比例，避免图片先变小再占满
const ratioCache = new Map<string, number>();

function PriceImage({ uri, width, onPress }: { uri: string; width: number; onPress: () => void }) {
  const [ratio, setRatio] = useState(() => ratioCache.get(uri) ?? 1);
  return (
    <Pressable accessibilityLabel="预览价目表图片" onPress={onPress} style={{ width }}>
      <CachedImage
        source={{ uri }}
        recyclingKey={uri}
        contentFit="contain"
        style={[styles.priceImage, { aspectRatio: ratio }]}
        onLoad={(event) => {
          const { width, height } = event.source;
          if (width > 0 && height > 0) {
            ratioCache.set(uri, width / height);
            setRatio(width / height);
          }
        }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  // 原 flex:1 是行内布局里横向铺满用的，ScreenHeader 的 titleWrap 已自适配宽度；
  // 传入后反而会让 Text 在纵向撑满页头导致标题上移，故删除
  navTitle: { color: "#0A0A0A", fontSize: 16, lineHeight: 24, fontWeight: "500", textAlign: "center" },
  tabsScroll: { flexGrow: 0, height: 54, backgroundColor: "#fff" },
  tabs: { minWidth: "100%", paddingHorizontal: 16, justifyContent: "space-around", backgroundColor: "#fff" },
  tab: {
    minWidth: 96,
    height: 54,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center", position: "relative",
  },
  tabText: { color: "#666", fontSize: 14, lineHeight: 22 },
  tabTextActive: { color: "#333", fontSize: 16, fontWeight: "600" },
  tabIndicator: { position: "absolute", bottom: 9, width: 12, height: 3, borderRadius: 2, backgroundColor: "#FE1F4C" },
  content: { flex: 1, backgroundColor: "#E6E6E6" },
  contentContainer: { minHeight: "100%", alignItems: "stretch" },
  images: { width: "100%" },
  hidden: { display: "none" },
  priceImage: { width: "100%", backgroundColor: "#E6E6E6" },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center", paddingTop: 100,
  },
  stateText: { padding: 32, color: "rgba(0,0,0,.35)", fontSize: 14, textAlign: "center" },
  retryText: { color: "#FE1F4C", fontSize: 14 },
});
