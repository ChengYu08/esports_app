import { showToast } from "@/shared/ui/app-toast";
import { useAuthStore } from "@esports/auth";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { grabQuickMatchAndEnterAudition } from "@/features/match/grab-quick-match-flow";
import { CachedImage } from "@/shared/ui/CachedImage";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { fetchDispatchDetail, isActivityDispatchRequest } from "../dispatch.api";

const DEFAULT_AVATAR = require("../../../../assets/svgs/order-seller-avatar.svg");
const GAME_FALLBACK = require("../../../../assets/svgs/game.svg");
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
    queryFn: ({ signal }) =>
      fetchDispatchDetail(requestNo, token as string, signal),
    enabled: Boolean(requestNo && token),
  });

  if (detail.isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>派单详情加载中...</Text>
      </View>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>派单详情加载失败</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void detail.refetch()}
        >
          <Text style={styles.retry}>点击重试</Text>
        </Pressable>
      </View>
    );
  }

  const request = detail.data;
  const status = String(request.status ?? "MATCHING").toUpperCase();
  const grabStatus = request.currentGrabStatus as GrabStatus | undefined;
  const hasGrabbed =
    grabbedLocally ||
    request.grabbed === true ||
    grabStatus === "GRABBED" ||
    grabStatus === "SUCCESS";
  const canGrab = status === "MATCHING" && !hasGrabbed && !grabStatus;
  const unitPrice =
    Number(gender === 1 ? request.maleUnitPrice : request.femaleUnitPrice) || 0;
  const quantity = Math.max(1, Number(request.quantity) || 1);
  const total = unitPrice * quantity;
  const serviceName =
    [request.modeName, request.levelName, request.serviceName]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join("-") || "陪玩服务";
  const statusLabel = getStatusLabel(status, grabStatus, hasGrabbed);
  const stateDescription = getStateDescription(status, grabStatus, hasGrabbed);
  /** 活动派单判定：activityCode 非空即活动需求；普通需求渲染零变化 */
  const isActivity = isActivityDispatchRequest(request);
  const cardItems = isActivity ? request.cardItems ?? [] : [];

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
      {/* 原页头为 88 高、内容贴底的异形结构：外层 View 负责总高与底部对齐，内部用 ScreenHeader 承载返回键/标题行。
          原页头行高由返回键文本 lineHeight 28 决定，总高公式为 max(88, insets.top + 28 + 12) = max(88, insets.top + 40)；
          若用组件默认 44 高，总高会被撑到 insets.top + 56，内容起点下移约 16px，故显式传 height 28 保持总高与迁移前一致 */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <ScreenHeader
          title="派单详情"
          onBack={() => router.back()}
          backIconColor="#111111"
          titleStyle={styles.headerTitle}
          height={28}
        />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 104 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusBlock}>
          <Text
            style={[
              styles.statusTitle,
              hasGrabbed && status !== "CANCELLED" && styles.grabbedTitle,
            ]}
          >
            {statusLabel}
          </Text>
          <Text style={styles.statusHint}>{stateDescription}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.userRow}>
            <CachedImage
              source={
                request.buyerHeadImage
                  ? { uri: request.buyerHeadImage }
                  : DEFAULT_AVATAR
              }
              contentFit="cover"
              style={styles.avatar}
            />
            <View style={styles.userCopy}>
              <Text style={styles.userName}>
                {request.buyerNickname || "老板"}
              </Text>
              <Text style={styles.userSub}>
                {request.publishType === "RECEPTION" ? "客服派单" : "用户派单"}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>需求信息</Text>
          <View style={styles.gameRow}>
            <CachedImage
              source={
                request.gameIconUrl
                  ? { uri: request.gameIconUrl }
                  : GAME_FALLBACK
              }
              contentFit="contain"
              style={styles.gameIcon}
            />
            <Text numberOfLines={1} style={styles.gameName}>
              {request.gameName || "未知游戏"}
            </Text>
          </View>
          {cardItems.length > 0 ? (
            <View style={styles.activityCard}>
              <Text style={styles.activityCardTitle}>活动信息</Text>
              {cardItems.map((item, index) => (
                <View key={`${item.label}-${index}`} style={styles.activityRow}>
                  <Text style={styles.activityLabel}>{item.label}</Text>
                  <Text numberOfLines={1} style={styles.activityValue}>{item.value?.text ?? ""}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <InfoRow label="服务" value={serviceName} />
          <InfoRow
            label="单价"
            value={`${unitPrice} 钻石/${request.billingUnitName || "小时"}`}
          />
          <InfoRow
            label="数量"
            value={`${quantity} ${request.billingUnitName || "小时"}`}
          />
          <InfoRow
            label="试音要求"
            value={request.needVoice ? "需要试音" : "不需要试音"}
          />
          <InfoRow
            label="备注"
            value={request.remark?.trim() || "无"}
            multiline
          />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>预估总额</Text>
            <Text style={styles.totalValue}>{total}</Text>
            <Text style={styles.totalUnit}>钻石</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>派单信息</Text>
          <InfoRow label="派单编号" value={request.requestNo || requestNo} />
          <InfoRow label="发布时间" value={formatTime(request.createTime)} />
          <InfoRow
            label="截止时间"
            value={formatTime(request.expireTime || request.endTime)}
          />
          <InfoRow
            label="已抢人数"
            value={`${Math.max(0, Number(request.grabCount) || 0)} 人`}
          />
        </View>
      </ScrollView>
      <View
        style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        <Pressable
          accessibilityRole="button"
          disabled={!canGrab || grabbing}
          onPress={() => void grabOrder()}
          style={[styles.action, !canGrab && styles.actionDisabled]}
        >
          {canGrab ? (
            <LinearGradient
              colors={ACTION_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionGradient}
            >
              <Text style={styles.actionText}>
                {grabbing ? "抢单中..." : "立即抢单"}
              </Text>
            </LinearGradient>
          ) : (
            <Text style={styles.actionDisabledText}>
              {hasGrabbed ? "已抢单，等待老板选择" : statusLabel}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function getStatusLabel(
  status: string,
  grabStatus?: GrabStatus,
  hasGrabbed = false,
) {
  // 落选（FAILED）只会与 ORDERED 共存，必须先于 ORDERED 判断，否则落选者永远看到"派单成功"
  if (grabStatus === "FAILED") return "抢单失败";
  if (status === "CANCELLED") return "老板已取消";
  if (status === "EXPIRED") return "派单已过期";
  if (status === "ORDERED") return "派单成功";
  if (grabStatus === "SUCCESS") return "抢单成功";
  return hasGrabbed ? "已抢单" : "未抢单";
}

function getStateDescription(
  status: string,
  grabStatus?: GrabStatus,
  hasGrabbed = false,
) {
  if (status === "CANCELLED") return "老板已取消本次需求";
  if (status === "EXPIRED") return "本次派单已超过有效时间";
  if (status === "ORDERED")
    return grabStatus === "FAILED"
      ? "老板已选择其他陪玩下单"
      : "老板已完成下单";
  if (grabStatus === "SUCCESS") return "抢单成功，等待订单开始";
  if (grabStatus === "FAILED") return "老板已选择其他陪玩下单";
  return hasGrabbed ? "已提交抢单，等待老板选择陪玩师" : "该需求当前尚未被抢单";
}

function InfoRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <View style={[styles.infoRow, multiline && styles.multilineRow]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, multiline && styles.multilineValue]}>
        {value}
      </Text>
    </View>
  );
}

function formatTime(value?: string) {
  return value ? value.replace("T", " ").slice(0, 19) : "-";
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#FFF",
  },
  muted: { color: "#999", fontSize: 14 },
  retry: { color: "#FF3158", fontSize: 14 },
  // 外层只管总高（minHeight 88，含 paddingTop insets.top）与内容贴底（paddingBottom 12 + flex-end）；
  // 内部 ScreenHeader 传 height 28（原返回键文本 lineHeight），总高 = max(88, insets.top + 40) 与迁移前一致
  header: {
    minHeight: 88,
    backgroundColor: "#FFF",
    justifyContent: "flex-end",
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: "#111",
    fontSize: 16,
    fontWeight: "600",
  },
  content: { gap: 12, paddingBottom: 24 },
  statusBlock: {
    backgroundColor: "#FFF",
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 8,
  },
  statusTitle: {
    color: "#F02A45",
    fontSize: 22,
    fontWeight: "700",
  },
  grabbedTitle: { color: "#228B66" },
  statusHint: {
    color: "#777",
    fontSize: 13,
    lineHeight: 20,
  },
  section: {
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
  },
  userRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  userCopy: { flex: 1, gap: 3 },
  userName: {
    color: "#111",
    fontSize: 15,
    fontWeight: "600",
  },
  userSub: { color: "#999", fontSize: 12 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EEE",
    marginVertical: 12,
  },
  sectionTitle: {
    marginBottom: 10,
    color: "#111",
    fontSize: 14,
    fontWeight: "600",
  },
  gameRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  gameIcon: { width: 20, height: 20 },
  gameName: { flex: 1, color: "#222", fontSize: 13 },
  activityCard: { gap: 6, padding: 12, borderRadius: 8, backgroundColor: "#FFF5F6" },
  activityCardTitle: { color: "#F02A45", fontSize: 13, fontWeight: "600" },
  activityRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  activityLabel: { width: 70, color: "#B98A90", fontSize: 12, lineHeight: 20 },
  activityValue: { flex: 1, color: "#F02A45", fontSize: 12, lineHeight: 20, textAlign: "right" },
  infoRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  multilineRow: { minHeight: 44 },
  label: {
    width: 70,
    color: "#999",
    fontSize: 12,
    lineHeight: 20,
  },
  value: {
    flex: 1,
    color: "#222",
    fontSize: 12,
    lineHeight: 20,
    textAlign: "right",
  },
  multilineValue: { textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#EEE",
  },
  totalLabel: { color: "#555", fontSize: 12 },
  totalValue: { color: "#F02A45", fontSize: 20, fontWeight: "700" },
  totalUnit: { color: "#F02A45", fontSize: 12 },
  bottom: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#FFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#EEE",
  },
  action: {
    height: 48,
    overflow: "hidden",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  actionDisabled: { backgroundColor: "#F3F3F3" },
  actionGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
  actionDisabledText: {
    color: "#888",
    fontSize: 14,
    fontWeight: "500",
  },
});
