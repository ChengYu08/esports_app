import { DOUYIN_SANS } from "@/shared/theme/typography";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePriceList } from "../hooks/use-home-data";
import { createImagePreviewParams } from "@/features/mine/image-preview.params";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncStates";
import { CachedImage } from "@/shared/ui/CachedImage";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";

export default function PriceListScreen() {
  const insets = useSafeAreaInsets();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const query = usePriceList(groupId);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const contentRef = useRef<ScrollView>(null);
  const tabs = useMemo(() => query.data ?? [], [query.data]);
  const activeIndex = selectedIndex < tabs.length ? selectedIndex : 0;
  const selectedTab = tabs[activeIndex];

  useEffect(() => {
    if (tabs.length === 0) return;

    // Load all price list images once the tab data arrives so switching tabs
    // can display the cached image immediately instead of waiting for a request.
    void Image.prefetch(tabs.map((tab) => tab.imageUrl), "memory-disk");
  }, [tabs]);

  const content = useMemo(() => {
    if (query.isLoading) return <LoadingState />;
    if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
    if (!selectedTab) return <EmptyState message="暂无价目表" />;
    return (
      <PriceImage
        key={selectedTab.imageUrl}
        uri={selectedTab.imageUrl}
        onPress={() => {
          const images = tabs.map((tab) => tab.imageUrl);
          router.push({
            pathname: "/image-preview",
                params: createImagePreviewParams(images, activeIndex),
          });
        }}
      />
    );
  }, [activeIndex, query, selectedTab, tabs]);

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
            <Pressable key={`${tab.menuTitle}-${tab.sortNo}`} onPress={() => { setSelectedIndex(index); contentRef.current?.scrollTo({ y: 0, animated: false }); }} style={styles.tab}>
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

function PriceImage({ uri, onPress }: { uri: string; onPress: () => void }) {
  const [ratio, setRatio] = useState(1);
  return (
    <Pressable accessibilityLabel="预览价目表图片" onPress={onPress}>
      <CachedImage
        source={{ uri }}
        recyclingKey={uri}
        contentFit="contain"
        style={[styles.priceImage, { aspectRatio: ratio }]}
        onLoad={(event) => {
          const { width, height } = event.source;
          if (width > 0 && height > 0) setRatio(width / height);
        }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  // 原 flex:1 是行内布局里横向铺满用的，ScreenHeader 的 titleWrap 已自适配宽度；
  // 传入后反而会让 Text 在纵向撑满页头导致标题上移，故删除
  navTitle: { color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 16, lineHeight: 24, fontWeight: "500", textAlign: "center" },
  tabsScroll: { flexGrow: 0, height: 54, backgroundColor: "#fff" },
  tabs: { minWidth: "100%", paddingHorizontal: 16, justifyContent: "space-around", backgroundColor: "#fff" },
  tab: {
    minWidth: 96,
    height: 54,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center", position: "relative",
  },
  tabText: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 14, lineHeight: 22 },
  tabTextActive: { color: "#333", fontSize: 16, fontWeight: "600" },
  tabIndicator: { position: "absolute", bottom: 9, width: 12, height: 3, borderRadius: 2, backgroundColor: "#E01B28" },
  content: { flex: 1, backgroundColor: "#E6E6E6" },
  contentContainer: { minHeight: "100%", alignItems: "center" },
  priceImage: { width: "100%", backgroundColor: "#E6E6E6" },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center", paddingTop: 100,
  },
  stateText: { padding: 32, color: "rgba(0,0,0,.35)", fontFamily: DOUYIN_SANS, fontSize: 14, textAlign: "center" },
  retryText: { color: "#E01B28", fontFamily: DOUYIN_SANS, fontSize: 14 },
});
