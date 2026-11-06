import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import Animated, { Easing, FadeInDown, ReduceMotion } from "react-native-reanimated";
import { requireLogin } from "@/shared/navigation/require-login";
import { SYSTEM_FONT, getDDinProStyle } from "@/shared/theme/typography";
import { showToast } from "@/shared/ui/app-toast";
import { CachedImage } from "@/shared/ui/CachedImage";
import { resolveHomeHighlightClub, type HomeBroadcast, type HomeHighlightClub, type HomeHighlightPerson } from "../api/home-highlights.api";
import type { HomeHighlightsState } from "../hooks/use-home-highlights";

const images = {
  broadcast: require("../../../../assets/home/highlight-broadcast-bg.png"),
  title: require("../../../../assets/home/highlight-broadcast-title.png"),
  diamond: require("../../../../assets/home/highlight-diamond.png"),
  clubs: require("../../../../assets/home/highlight-club.png"),
  ranking: require("../../../../assets/home/highlight-ranking.png"),
};
const slots = [0, 1, 2];

export const HomeHighlights = memo(function HomeHighlights({ state, paused, onOpenRanking }: {
  state: HomeHighlightsState;
  paused: boolean;
  onOpenRanking: () => void;
}) {
  const queryClient = useQueryClient();
  const [contentWidth, setContentWidth] = useState(343);
  const scale = contentWidth / 343;
  const resolving = useRef(new Set<string>());
  const openRecharge = () => {
    if (requireLogin()) {
      router.push("/star-recharge");
    }
  };
  const openClub = async (club: HomeHighlightClub) => {
    const key = `${club.name}\u0000${club.avatar}`;
    if (resolving.current.has(key)) {
      return;
    }
    resolving.current.add(key);
    try {
      const id = club.id ?? await queryClient.fetchQuery<string>({
        queryKey: ["home-highlight-club-id", club.name, club.avatar],
        queryFn: ({ signal }) => resolveHomeHighlightClub(club, signal),
        staleTime: 5 * 60_000,
      });
      router.push({ pathname: "/club/[id]", params: { id } });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "俱乐部详情加载失败，请稍后重试");
    } finally {
      resolving.current.delete(key);
    }
  };
  const openPerson = (person: HomeHighlightPerson) => {
    router.push({ pathname: "/profile", params: { userId: person.id } });
  };

  return (
    <View>
      <View style={styles.broadcastFloor}>
        <View style={styles.broadcast} onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}>
          <CachedImage source={images.broadcast} contentFit="fill" style={StyleSheet.absoluteFill} accessible={false} />
          <CachedImage source={images.title} contentFit="contain" style={styles.broadcastTitle} accessible={false} />
          <BroadcastContent items={state.broadcasts.data ?? []} active={state.active && !paused}
            scale={scale}
            loading={state.broadcasts.isPending} error={state.broadcasts.isError}
            onRetry={state.broadcasts.refetch} />
          <Pressable onPress={openRecharge} accessibilityRole="button" accessibilityLabel="钻石充值" style={styles.diamondButton}>
            <CachedImage source={images.diamond} contentFit="contain" style={styles.diamond} accessible={false} />
          </Pressable>
        </View>
      </View>
      <View style={styles.cardsFloor}>
        <HighlightCard scale={scale} image={images.clubs} label="热门俱乐部" items={state.clubs.data ?? []}
          loading={state.clubs.isPending} error={state.clubs.isError} onRetry={state.clubs.refetch} onSelect={openClub} />
        <HighlightCard scale={scale} image={images.ranking} label="每周接单推荐榜" items={state.ranking.data ?? []}
          loading={state.ranking.isPending} error={state.ranking.isError} onRetry={state.ranking.refetch}
          onTitlePress={onOpenRanking} onSelect={openPerson} />
      </View>
    </View>
  );
});

function BroadcastContent({ items, active, loading, error, onRetry, scale }: {
  items: HomeBroadcast[]; active: boolean; loading: boolean; error: boolean; onRetry: () => unknown; scale: number;
}) {
  const [index, setIndex] = useState(0);
  const count = items.length;
  // 对齐 Web：新广播从一行高度的下方滑入，并在 500ms 内渐显。
  const entering = useMemo(() => FadeInDown
    .duration(500)
    .easing(Easing.bezier(0.25, 0.1, 0.25, 1))
    .withInitialValues({ opacity: 0, translateY: 46 * scale })
    .reduceMotion(ReduceMotion.System), [scale]);
  useEffect(() => {
    if (!active || count <= 1) {
      return;
    }
    const timer = setInterval(() => setIndex((value) => (value + 1) % count), 3000);
    return () => clearInterval(timer);
  }, [active, count]);
  const item = items[count > 0 ? index % count : 0];
  if (!item) {
    return <Pressable disabled={!error} onPress={onRetry} style={styles.broadcastStatus} accessibilityRole={error ? "button" : undefined}>
      <Text style={styles.statusText}>{loading ? "加载中…" : error ? "加载失败，点击重试" : "暂无充值广播"}</Text>
    </Pressable>;
  }
  return (
    <View style={[styles.broadcastViewport, { height: 46 * scale }]} collapsable={false}
      accessibilityLabel={`${item.nickname}充值了${item.amount}钻石`}>
      <Animated.View key={item.id} entering={entering} style={[styles.broadcastContent, { gap: 10 * scale }]}>
        <Avatar uri={item.avatar} name={item.nickname} broadcast scale={scale} />
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.broadcastMessage, { fontSize: 12 * scale, lineHeight: 22 * scale }]}>
          {item.nickname.length > 4 ? `${item.nickname.slice(0, 3)}…` : item.nickname}充值了 {""}
          <Text style={[styles.amount, { fontSize: 18 * scale }]}>{item.amount}</Text> 钻石
        </Text>
      </Animated.View>
    </View>
  );
}

function Avatar({ uri, name, broadcast = false, scale = 1 }: { uri: string; name: string; broadcast?: boolean; scale?: number }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return <View style={[styles.avatar, broadcast && styles.broadcastAvatar, broadcast && { width: 46 * scale, height: 46 * scale, borderRadius: 23 * scale }]}>
    <Text style={styles.avatarFallback}>{name.slice(0, 1) || "盼"}</Text>
    {uri && failedUri !== uri ? <CachedImage source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" onError={() => setFailedUri(uri)} accessible={false} /> : null}
  </View>;
}

function HighlightCard<T extends HomeHighlightClub | HomeHighlightPerson>({ image, label, items, loading, error, onRetry, onSelect, onTitlePress, scale }: {
  image: ImageSourcePropType; label: string; items: T[]; loading: boolean; error: boolean;
  onRetry: () => unknown; onSelect: (item: T) => unknown; onTitlePress?: () => void;
  scale: number;
}) {
  return <View style={styles.card}>
    <View style={styles.cardArtwork}>
      <CachedImage source={image} contentFit="fill" style={StyleSheet.absoluteFill} accessible={false} />
      <Pressable disabled={!onTitlePress} onPress={onTitlePress} accessibilityRole={onTitlePress ? "button" : "header"}
        accessibilityLabel={label} style={styles.cardTitle} />
      <View style={styles.people}>
        {slots.map((slot) => {
          const item = items[slot];
          const name = Array.from(item?.name ?? "待上榜");
          const displayName = name.length > 3 ? `${name.slice(0, 3).join("")}...` : name.join("");
          return <Pressable key={slot} disabled={!item} onPress={() => item && onSelect(item)} style={[styles.person, { left: `${[7.77, 38.85, 69.52][slot]}%` }]}
            accessibilityRole={item ? "button" : undefined} accessibilityLabel={item ? `查看${item.name}` : "暂无推荐"}>
            <Avatar uri={item?.avatar ?? ""} name={item?.name ?? ""} />
            <Text numberOfLines={1} style={[styles.personName, { marginTop: 5 * scale, fontSize: 10 * scale, lineHeight: 14 * scale }]}>{displayName}</Text>
          </Pressable>;
        })}
      </View>
    </View>
    {/* 延续原图底部纹理，增加留白时保持头像装饰圈比例不变。 */}
    <View pointerEvents="none" style={styles.cardBottom}>
      <CachedImage source={image} contentFit="cover" contentPosition="bottom" style={StyleSheet.absoluteFill} accessible={false} />
    </View>
    {items.length === 0 && <Pressable disabled={!error} onPress={onRetry} style={styles.cardStatus} accessibilityRole={error ? "button" : undefined}>
      <Text style={styles.statusText}>{loading ? "加载中…" : error ? "加载失败，点击重试" : "暂无推荐"}</Text>
    </Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  broadcastFloor: { paddingHorizontal: 16, paddingVertical: 4 },
  broadcast: { width: "100%", aspectRatio: 343 / 64, backgroundColor: "#4D0B18", borderRadius: 8, overflow: "hidden", justifyContent: "center" },
  broadcastTitle: { position: "absolute", left: "1.75%", width: "18.66%", height: "75%" },
  broadcastViewport: { position: "absolute", left: "24%", right: "17.5%", overflow: "hidden" },
  broadcastContent: { width: "100%", height: "100%", flexDirection: "row", alignItems: "center", gap: 10 },
  broadcastAvatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: "#FFB0AF", flexShrink: 0 },
  broadcastMessage: { flex: 1, fontFamily: SYSTEM_FONT, fontSize: 12, lineHeight: 22, fontWeight: "700", color: "#FFF" },
  amount: { ...getDDinProStyle(800), fontSize: 18, color: "#FFED65" },
  diamondButton: { position: "absolute", right: 0, width: "17.5%", height: "100%", alignItems: "center", justifyContent: "center" },
  diamond: { width: "90%", height: "90%" },
  broadcastStatus: { marginLeft: "27%", marginRight: "18%", minHeight: 44, justifyContent: "center", alignItems: "center" },
  cardsFloor: { flexDirection: "row", paddingTop: 4, paddingBottom: 8, paddingHorizontal: 16, gap: 8 },
  card: { flex: 1, aspectRatio: 167 / 96, borderRadius: 8, overflow: "hidden", backgroundColor: "#25112D" },
  cardArtwork: { width: "100%", aspectRatio: 167 / 88 },
  cardBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: "8.34%", overflow: "hidden" },
  cardTitle: { position: "absolute", left: 0, top: 0, right: 0, height: "32%" },
  people: { position: "absolute", top: "35.6%", left: 0, right: 0, height: "64.4%" },
  person: { position: "absolute", width: "22.31%", alignItems: "center" },
  avatar: { width: "100%", aspectRatio: 1, borderRadius: 100, overflow: "hidden", backgroundColor: "#17111B", alignItems: "center", justifyContent: "center" },
  avatarFallback: { fontFamily: SYSTEM_FONT, color: "#D3C6DA", fontSize: 15 },
  personName: { marginTop: 5, width: "132%", fontFamily: SYSTEM_FONT, fontSize: 10, lineHeight: 14, color: "#FFF", textAlign: "center" },
  cardStatus: { position: "absolute", left: 0, right: 0, bottom: 0, height: "25%", alignItems: "center", justifyContent: "center", backgroundColor: "#201126" },
  statusText: { fontFamily: SYSTEM_FONT, fontSize: 10, lineHeight: 16, color: "#E5D7E8" },
});
