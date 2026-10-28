import { ChevronRight16Regular } from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  router,
  useFocusEffect,
  useIsFocused,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Toast from "react-native-root-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VoicePlayButton } from "@/shared/audio/VoicePlayButton";
import { useVoicePlayer } from "@/shared/audio/use-voice-player";
import { usePullToRefresh } from "@/shared/hooks/use-pull-to-refresh";
import { colors } from "@/shared/theme/tokens";
import { EmptyState } from "@/shared/ui/AsyncStates";
import { CachedImage } from "@/shared/ui/CachedImage";
import { companionManagementApi as api } from "../api/companion-management.api";
import {
  formatManagementNumber as format,
  type ManagedImage,
  type ManagedService,
} from "../api/companion-management.contract";
import { newestCompanionImages } from "../companion-image-order";
import { CompanionAgreementSheet } from "../components/CompanionAgreementSheet";
import { CompanionDashboardHeader } from "../components/CompanionDashboardHeader";
import { CompanionImagePreview } from "../components/CompanionImagePreview";
import {
  useCompanionOverview,
  useManagedGame,
} from "../hooks/use-companion-management";
import { useCompanionVoiceUpload } from "../hooks/use-companion-voice-upload";

const bambooIcon = require("../../../../assets/mine/companion/bamboo.svg");
const ordersIcon = require("../../../../assets/mine/companion/orders.svg");
const switchOn = require("../../../../assets/mine/companion/switch-on.svg");
const switchOff = require("../../../../assets/mine/companion/switch-off.svg");

export default function CompanionDashboardScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const { gameId: requestedGameId } = useLocalSearchParams<{
    gameId?: string;
  }>();
  const { account, wallet, orders, games } = useCompanionOverview();
  const [selectedGameId, setSelectedGameId] = useState(requestedGameId);
  const game =
    games.data?.find((item) => String(item.gameId) === selectedGameId) ??
    games.data?.[0];
  const gameId = game ? String(game.gameId) : undefined;
  const managed = useManagedGame(gameId, true);
  const detail = managed.detail.data;
  const [previewImage, setPreviewImage] = useState<ManagedImage | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());
  const pendingIds = useRef(new Set<number>());
  const { playingUrl, stop, toggle } = useVoicePlayer();
  const voiceUpload = useCompanionVoiceUpload(managed, stop);
  useFocusEffect(useCallback(() => stop, [stop]));
  const images = newestCompanionImages(detail?.images ?? []).filter(
    (item) => item.imageUrl,
  );
  const imageSize = (width - 32 - 16) / 5;
  const refresh = () =>
    Promise.all([
      wallet.refetch(),
      orders.refetch(),
      games.refetch(),
      ...(gameId ? [managed.detail.refetch(), managed.services.refetch()] : []),
    ]);
  const pullToRefresh = usePullToRefresh(refresh);
  const toggleService = async (service: ManagedService) => {
    if (!gameId || pendingIds.current.has(service.companionServiceId)) return;
    const id = service.companionServiceId;
    pendingIds.current.add(id);
    setUpdatingIds(new Set(pendingIds.current));
    try {
      managed.assertCurrentAccount();
      await api.updateService(
        managed.context,
        managed.token,
        id,
        service.status !== 1,
      );
      await managed.invalidate();
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : "服务状态更新失败", {
        duration: Toast.durations.SHORT,
      });
    } finally {
      pendingIds.current.delete(id);
      setUpdatingIds(new Set(pendingIds.current));
    }
  };
  const openEditor = (pathname: "/companion-intro" | "/companion-gallery") => {
    if (!gameId) return;
    stop();
    router.push({ pathname, params: { gameId } });
  };
  const formattedRate = format(orders.data?.goodRate);
  const rate = formattedRate === "--" ? "0" : formattedRate;

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={["#D9EAF9", "#E1EAFE"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <CompanionDashboardHeader title="陪玩管理" />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustsScrollIndicatorInsets={false}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={game && !games.isError ? [1] : undefined}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isFocused && pullToRefresh.refreshing}
            onRefresh={pullToRefresh.onRefresh}
          />
        }
      >
        <View style={styles.statistics}>
          <View style={styles.statCard}>
            <View style={styles.cardHeading}>
              <View style={styles.labelRow}>
                <Image source={bambooIcon} style={styles.statIcon} />
                <Text style={styles.statLabel}>当前竹子</Text>
              </View>
              <TextAction
                title="竹子明细"
                onPress={() => router.push("/companion-income")}
              />
            </View>
            <Text style={styles.statValue}>
              {wallet.isError ? "--" : format(wallet.data?.withdrawablePan, 2)}
            </Text>
            <Text style={[styles.statCaption, styles.balanceCaption]}>
              累积已收入
              <Text style={styles.captionValue}>
                {wallet.isError ? "--" : format(wallet.data?.totalIncomePan, 2)}
              </Text>
            </Text>
            {wallet.isError ? (
              <TextAction
                title="加载失败，点击重试"
                onPress={() => void wallet.refetch()}
              />
            ) : null}
          </View>
          <View style={styles.statCard}>
            <View style={styles.cardHeading}>
              <View style={styles.labelRow}>
                <Image source={ordersIcon} style={styles.statIcon} />
                <Text style={styles.statLabel}>当前接单</Text>
              </View>
              <TextAction
                title="订单中心"
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/order",
                    params: { scope: "accept" },
                  })
                }
              />
            </View>
            <Text style={styles.statValue}>
              {orders.isError ? "--" : format(orders.data?.currentOrderCount)}
            </Text>
            <View style={styles.captionRow}>
              <Text style={styles.statCaption}>
                累积接单
                <Text style={styles.captionValue}>
                  {orders.isError
                    ? "--"
                    : format(orders.data?.totalCompletedCount)}
                </Text>
              </Text>
              <Text style={styles.statCaption}>
                好评
                <Text style={styles.captionValue}>{rate}%</Text>
              </Text>
            </View>
            {orders.isError ? (
              <TextAction
                title="加载失败，点击重试"
                onPress={() => void orders.refetch()}
              />
            ) : null}
          </View>
        </View>
        {account.unavailable ? (
          <QueryState message={account.unavailable} />
        ) : games.isError ? (
          <QueryState
            message={games.error.message}
            onRetry={() => void games.refetch()}
          />
        ) : games.isPending ? (
          <QueryState loading />
        ) : !game ? (
          <View style={styles.emptyPanel}>
            <EmptyState
              message="这里空无一物～"
              style={{ flex: 1, paddingBottom: insets.bottom }}
            />
          </View>
        ) : (
          <View style={styles.tabsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabs}
            >
              {games.data?.map((item) => (
                <Pressable
                  key={item.gameId}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: item.gameId === game.gameId }}
                  onPress={() => {
                    stop();
                    setSelectedGameId(String(item.gameId));
                  }}
                  style={styles.tab}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      item.gameId === game.gameId && styles.selectedTab,
                    ]}
                  >
                    {item.gameName}
                  </Text>
                  {item.gameId === game.gameId ? (
                    <View style={styles.tabIndicator} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
        {game && !games.isError && !account.unavailable ? (
          <View
            style={[
              styles.body,
              { paddingBottom: Math.max(insets.bottom, 32) },
            ]}
          >
            {managed.detail.isError ? (
              <QueryState
                message={managed.detail.error.message}
                onRetry={() => void managed.detail.refetch()}
              />
            ) : managed.detail.isPending ? (
              <QueryState loading />
            ) : detail ? (
              <>
                <View>
                  <SectionHeading
                    title="能力介绍"
                    action="编辑"
                    onPress={() => openEditor("/companion-intro")}
                  />
                  <Text style={styles.intro}>
                    {detail.skillIntro?.trim() || "还没有填写能力介绍"}
                  </Text>
                </View>
                <View>
                  <SectionHeading
                    title="语音介绍"
                    action={
                      voiceUpload.uploading
                        ? "上传中..."
                        : detail.voiceUrl
                          ? "替换音频"
                          : "上传"
                    }
                    disabled={voiceUpload.uploading}
                    onPress={voiceUpload.upload}
                  />
                  <View style={styles.voiceContent}>
                    {detail.voiceUrl ? (
                      <VoicePlayButton
                        url={detail.voiceUrl}
                        duration={detail.voiceDurationSeconds}
                        playingUrl={playingUrl}
                        onToggleVoice={toggle}
                        inline
                        compact
                      />
                    ) : (
                      <Text style={styles.noImages}>暂未上传语音介绍</Text>
                    )}
                  </View>
                </View>
                <View>
                  <SectionHeading
                    title="技能截图"
                    action="管理"
                    onPress={() => openEditor("/companion-gallery")}
                  />
                  <View style={styles.imageGrid}>
                    {images.length ? (
                      images.map((item, index) => (
                        <Pressable
                          key={item.id}
                          accessibilityRole="button"
                          accessibilityLabel={`查看技能截图${index + 1}`}
                          onPress={() => {
                            stop();
                            setPreviewImage(item);
                          }}
                          style={[
                            styles.imageCell,
                            { width: imageSize, height: imageSize },
                          ]}
                        >
                          <CachedImage
                            source={{ uri: item.imageUrl }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                          />
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.noImages}>
                        暂无技能截图，点击管理添加
                      </Text>
                    )}
                  </View>
                </View>
              </>
            ) : null}
            <View>
              <SectionHeading title="陪玩服务" />
              {managed.services.isError ? (
                <QueryState
                  message={managed.services.error.message}
                  onRetry={() => void managed.services.refetch()}
                />
              ) : managed.services.isPending ? (
                <QueryState loading />
              ) : (
                <View style={styles.serviceGroups}>
                  {managed.services.data?.length ? (
                    managed.services.data.map((level) => (
                      <View
                        key={`${level.gameModeId}-${level.id}`}
                        style={styles.serviceCard}
                      >
                        <Text style={styles.serviceTitle}>
                          {[game.gameName, level.gameModeName, level.levelName]
                            .filter(Boolean)
                            .join("-")}
                        </Text>
                        <View style={styles.divider} />
                        {level.companionServiceList?.length ? (
                          level.companionServiceList.map((service) => (
                            <ServiceRow
                              key={service.companionServiceId}
                              service={service}
                              goodRate={
                                service.goodRate ??
                                detail?.skillCards?.find(
                                  (card) =>
                                    card.companionServiceId ===
                                    service.companionServiceId,
                                )?.goodRate
                              }
                              busy={updatingIds.has(service.companionServiceId)}
                              onToggle={() => void toggleService(service)}
                            />
                          ))
                        ) : (
                          <Text style={styles.noImages}>暂无已分配服务</Text>
                        )}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noImages}>暂无已分配服务类型</Text>
                  )}
                </View>
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>
      <CompanionImagePreview
        image={previewImage}
        onClose={() => setPreviewImage(null)}
      />
      {isFocused && account.enabled ? (
        <CompanionAgreementSheet key={account.context.userId} />
      ) : null}
    </View>
  );
}

function QueryState({
  loading,
  message,
  onRetry,
}: {
  loading?: boolean;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.queryState}>
      {loading ? <ActivityIndicator color={colors.brand} /> : null}
      <Text style={styles.queryText}>{loading ? "正在加载…" : message}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.retry}
        >
          <Text style={styles.retryText}>重试</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
function TextAction({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={10}
      style={styles.textAction}
    >
      <Text style={styles.actionText}>{title}</Text>
      <ChevronRight16Regular width={10} height={10} color={colors.textMuted} />
    </Pressable>
  );
}
function SectionHeading({
  title,
  action,
  onPress,
  disabled,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onPress ? (
        <TextAction title={action} onPress={onPress} disabled={disabled} />
      ) : null}
    </View>
  );
}
function ServiceRow({
  service,
  goodRate,
  busy,
  onToggle,
}: {
  service: ManagedService;
  goodRate?: number | string | null;
  busy: boolean;
  onToggle: () => void;
}) {
  const formattedRate = format(goodRate);
  const rate = formattedRate === "--" ? "0" : formattedRate;
  return (
    <View style={styles.service}>
      <View style={styles.serviceLine}>
        <Text style={styles.serviceName} numberOfLines={1}>
          {service.clubGameServiceName || "未命名服务"}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{format(service.price)}星钻</Text>
          {service.unit ? (
            <Text style={styles.unit}>/{service.unit}</Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={service.clubGameServiceName || "接单开关"}
          accessibilityState={{ checked: service.status === 1, disabled: busy }}
          aria-checked={service.status === 1}
          disabled={busy}
          onPress={onToggle}
          hitSlop={10}
          style={styles.switchHitArea}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <Image
              source={service.status === 1 ? switchOn : switchOff}
              style={styles.switchIcon}
            />
          )}
        </Pressable>
      </View>
      <Text style={styles.serviceCaption}>
        订单 {format(service.orderCount ?? 0)} 好评 {rate}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#E0EBFB" },
  scrollContent: { flexGrow: 1 },
  statistics: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: "#F9FCFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 22,
    marginBottom: 8,
  },
  labelRow: { flexDirection: "row", gap: 4, alignItems: "center" },
  statIcon: { width: 16, height: 16 },
  statLabel: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
    color: "#0A0A0A",
  },
  statValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
    color: "#0A0A0A",
    fontVariant: ["tabular-nums"],
  },
  statCaption: { fontSize: 12, lineHeight: 18, color: "#808080" },
  balanceCaption: { marginTop: 4 },
  captionValue: { color: "#0A0A0A", fontWeight: "500" },
  captionRow: { marginTop: 4, flexDirection: "row", gap: 8 },
  textAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 24,
  },
  actionText: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  tabsContainer: { backgroundColor: "#FFF" },
  tabs: {
    backgroundColor: "#FFF",
    flexDirection: "row",
    gap: 24,
    paddingHorizontal: 16,
    height: 54,
    alignItems: "center",
  },
  tab: { height: 30, justifyContent: "center" },
  tabLabel: { color: "#656566", fontSize: 14, lineHeight: 22 },
  selectedTab: { color: "#0D0D0F", fontWeight: "600", fontSize: 16 },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 3,
    width: 12,
    backgroundColor: "#FE1F4C",
    borderRadius: 2,
    alignSelf: "center",
  },
  body: { backgroundColor: "#FFF", gap: 12, flexGrow: 1 },
  sectionHeading: {
    paddingHorizontal: 16,
    height: 46,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  intro: {
    marginHorizontal: 16,
    color: "#0A0A0A",
    fontSize: 12,
    lineHeight: 18,
  },
  voiceContent: {
    paddingHorizontal: 16,
    minHeight: 24,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  voiceHint: { marginTop: 4, color: "#999", fontSize: 12, lineHeight: 18 },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 4,
  },
  imageCell: {
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#F7F7F7",
  },
  noImages: { color: "#999", fontSize: 12, lineHeight: 22 },
  serviceGroups: { gap: 12, paddingHorizontal: 16 },
  serviceCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    gap: 12,
  },
  serviceTitle: {
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#E9E9EB" },
  service: { gap: 4 },
  serviceLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 18,
  },
  serviceName: {
    flex: 1,
    color: "#656566",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  price: { color: "#0A0A0A", fontSize: 11, lineHeight: 16 },
  unit: { color: "#999", fontSize: 11, lineHeight: 16 },
  switchHitArea: {
    width: 32,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  switchIcon: { width: 32, height: 18 },
  serviceCaption: { color: "#999", fontSize: 11, lineHeight: 14 },
  queryState: { padding: 24, alignItems: "center", gap: 12 },
  queryText: {
    color: "#808080",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  retry: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  retryText: { color: "#FE1F4C", fontSize: 12 },
  emptyPanel: {
    flex: 1,
    minHeight: 240,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: "#FFF",
  },
});
