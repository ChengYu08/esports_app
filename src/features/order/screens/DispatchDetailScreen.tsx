import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { showToast } from "@/shared/ui/app-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@esports/auth";

import { fetchDispatchDetail } from "../dispatch.api";
import { grabQuickMatchAndEnterAudition } from "@/features/match/grab-quick-match-flow";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { CachedImage } from "@/shared/ui/CachedImage";

const DEFAULT_AVATAR = require("../../../../assets/order/order-seller-avatar.svg");
const GAME_FALLBACK = require("../../../../assets/voice-room/game.svg");
const ACTION_GRADIENT = ["#FF2145", "#FF3158"] as const;

type GrabStatus = "GRABBED" | "SUCCESS" | "FAILED";

export function DispatchDetailScreen({ requestNo }: { requestNo: string }) {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.accessToken);
  const gender = useAuthStore((state) => state.user?.gender ?? 2);
  const [grabbing, setGrabbing] = useState(false);
  const [grabbedLocally, setGrabbedLocally] = useState(false);
  const detail = useQuery({
    queryKey: ["dispatch-detail", requestNo],
    queryFn: ({ signal }) => fetchDispatchDetail(requestNo, token as string, signal),
    enabled: Boolean(requestNo && token),
  });

  if (detail.isLoading) {
    return <View style={styles.center}><Text style={styles.muted}>派单详情加载中...</Text></View>;
  }
  if (detail.isError || !detail.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>派单详情加载失败</Text>
        <Pressable accessibilityRole="button" onPress={() => void detail.refetch()}><Text style={styles.retry}>点击重试</Text></Pressable>
      </View>
    );
  }

  const request = detail.data;
  const status = String(request.status ?? "MATCHING").toUpperCase();
  const grabStatus = request.currentGrabStatus as GrabStatus | undefined;
  const hasGrabbed = grabbedLocally || request.grabbed === true || grabStatus === "GRABBED" || grabStatus === "SUCCESS";
  const canGrab = status === "MATCHING" && !hasGrabbed && !grabStatus;
  const unitPrice = Number(gender === 1 ? request.maleUnitPrice : request.femaleUnitPrice) || 0;
  const quantity = Math.max(1, Number(request.quantity) || 1);
  const total = unitPrice * quantity;
  const serviceName = [request.modeName, request.levelName, request.serviceName]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join("-") || "陪玩服务";
  const statusLabel = getStatusLabel(status, grabStatus, hasGrabbed);
  const stateDescription = getStateDescription(status, grabStatus, hasGrabbed);

  const grabOrder = async () => {
    if (!canGrab || !request.requestNo || !token || grabbing) return;
    setGrabbing(true);
    try {
      // 与抢单条同一条流程；replace 进房后从语聊房返回直接回派单中心
      const result = await grabQuickMatchAndEnterAudition(request.requestNo, {
        replaceRoom: true,
      });
      if (result.status === "failed") {
        showToast(result.message);
        return;
      }
      if (result.status !== "grabbed") return;
      setGrabbedLocally(true);
      await detail.refetch();
    } finally {
      setGrabbing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable accessibilityLabel="返回" hitSlop={12} onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>派单详情</Text>
        <View style={styles.headerSlot} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 104 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.statusBlock}>
          <Text style={[styles.statusTitle, hasGrabbed && styles.grabbedTitle]}>{statusLabel}</Text>
          <Text style={styles.statusHint}>{stateDescription}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.userRow}>
            <CachedImage source={request.buyerHeadImage ? { uri: request.buyerHeadImage } : DEFAULT_AVATAR} contentFit="cover" style={styles.avatar} />
            <View style={styles.userCopy}>
              <Text style={styles.userName}>{request.buyerNickname || "老板"}</Text>
              <Text style={styles.userSub}>{request.publishType === "RECEPTION" ? "客服派单" : "用户派单"}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>需求信息</Text>
          <View style={styles.gameRow}>
            <CachedImage source={request.gameIconUrl ? { uri: request.gameIconUrl } : GAME_FALLBACK} contentFit="contain" style={styles.gameIcon} />
            <Text numberOfLines={1} style={styles.gameName}>{request.gameName || "未知游戏"}</Text>
          </View>
          <InfoRow label="服务" value={serviceName} />
          <InfoRow label="单价" value={`${unitPrice} 星钻/${request.billingUnitName || "小时"}`} />
          <InfoRow label="数量" value={`${quantity} ${request.billingUnitName || "小时"}`} />
          <InfoRow label="试音要求" value={request.needVoice ? "需要试音" : "不需要试音"} />
          <InfoRow label="备注" value={request.remark?.trim() || "无"} multiline />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>预估总额</Text>
            <Text style={styles.totalValue}>{total}</Text>
            <Text style={styles.totalUnit}>星钻</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>派单信息</Text>
          <InfoRow label="派单编号" value={request.requestNo || requestNo} />
          <InfoRow label="发布时间" value={formatTime(request.createTime)} />
          <InfoRow label="截止时间" value={formatTime(request.expireTime || request.endTime)} />
          <InfoRow label="已抢人数" value={`${Math.max(0, Number(request.grabCount) || 0)} 人`} />
        </View>
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable accessibilityRole="button" disabled={!canGrab || grabbing} onPress={() => void grabOrder()} style={[styles.action, !canGrab && styles.actionDisabled]}>
          {canGrab ? (
            <LinearGradient colors={ACTION_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionGradient}>
              <Text style={styles.actionText}>{grabbing ? "抢单中..." : "立即抢单"}</Text>
            </LinearGradient>
          ) : (
            <Text style={styles.actionDisabledText}>{hasGrabbed ? "已抢单，等待老板选择" : statusLabel}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function getStatusLabel(status: string, grabStatus?: GrabStatus, hasGrabbed = false) {
  if (status === "CANCELLED") return "老板已取消";
  if (status === "EXPIRED") return "派单已过期";
  if (status === "ORDERED") return "派单成功";
  if (grabStatus === "SUCCESS") return "抢单成功";
  if (grabStatus === "FAILED") return "抢单失败";
  return hasGrabbed ? "已被抢单" : "未被抢单";
}

function getStateDescription(status: string, grabStatus?: GrabStatus, hasGrabbed = false) {
  if (status === "CANCELLED") return "老板已取消本次需求";
  if (status === "EXPIRED") return "本次派单已超过有效时间";
  if (status === "ORDERED") return grabStatus === "FAILED" ? "老板已选择其他陪玩师" : "老板已完成下单";
  if (grabStatus === "SUCCESS") return "抢单成功，等待订单开始";
  if (grabStatus === "FAILED") return "老板已选择其他陪玩师";
  return hasGrabbed ? "已提交抢单，等待老板选择陪玩师" : "该需求当前尚未被抢单";
}

function InfoRow({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <View style={[styles.infoRow, multiline && styles.multilineRow]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, multiline && styles.multilineValue]}>{value}</Text>
    </View>
  );
}

function formatTime(value?: string) {
  return value ? value.replace("T", " ").slice(0, 19) : "-";
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#FFF" },
  muted: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 14 },
  retry: { color: "#FF3158", fontFamily: DOUYIN_SANS, fontSize: 14 },
  header: { minHeight: 88, backgroundColor: "#FFF", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  back: { width: 32, alignItems: "flex-start" },
  backText: { color: "#111", fontSize: 34, lineHeight: 28, fontWeight: "300" },
  headerTitle: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 16, fontWeight: "600" },
  headerSlot: { width: 32 },
  content: { gap: 12, paddingBottom: 24 },
  statusBlock: { backgroundColor: "#FFF", paddingHorizontal: 20, paddingVertical: 22, gap: 8 },
  statusTitle: { color: "#F02A45", fontFamily: DOUYIN_SANS, fontSize: 22, fontWeight: "700" },
  grabbedTitle: { color: "#228B66" },
  statusHint: { color: "#777", fontFamily: DOUYIN_SANS, fontSize: 13, lineHeight: 20 },
  section: { backgroundColor: "#FFF", paddingHorizontal: 16, paddingVertical: 14, borderRadius: 8 },
  userRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  userCopy: { flex: 1, gap: 3 },
  userName: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 15, fontWeight: "600" },
  userSub: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#EEE", marginVertical: 12 },
  sectionTitle: { marginBottom: 10, color: "#111", fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "600" },
  gameRow: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 8 },
  gameIcon: { width: 20, height: 20 },
  gameName: { flex: 1, color: "#222", fontFamily: DOUYIN_SANS, fontSize: 13 },
  infoRow: { minHeight: 34, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  multilineRow: { minHeight: 44 },
  label: { width: 70, color: "#999", fontFamily: DOUYIN_SANS, fontSize: 12, lineHeight: 20 },
  value: { flex: 1, color: "#222", fontFamily: DOUYIN_SANS, fontSize: 12, lineHeight: 20, textAlign: "right" },
  multilineValue: { textAlign: "left" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 5, marginTop: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EEE" },
  totalLabel: { color: "#555", fontFamily: DOUYIN_SANS, fontSize: 12 },
  totalValue: { color: "#F02A45", fontSize: 20, fontWeight: "700" },
  totalUnit: { color: "#F02A45", fontFamily: DOUYIN_SANS, fontSize: 12 },
  bottom: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: "#FFF", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EEE" },
  action: { height: 48, overflow: "hidden", borderRadius: 24, alignItems: "center", justifyContent: "center" },
  actionDisabled: { backgroundColor: "#F3F3F3" },
  actionGradient: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  actionText: { color: "#FFF", fontFamily: DOUYIN_SANS, fontSize: 15, fontWeight: "600" },
  actionDisabledText: { color: "#888", fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "500" },
});
