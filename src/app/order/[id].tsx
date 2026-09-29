import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import { ORDER_ITEMS } from "@/features/order/order.data";

export default function OrderDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const order = ORDER_ITEMS.find((item) => item.id === id) ?? ORDER_ITEMS[0];
  const isPending = order.status === "pendingPayment";

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable accessibilityLabel="返回" hitSlop={12} onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>订单详情</Text>
        <View style={styles.headerSlot} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#FFF0F1", "#FFF8F8"]} style={styles.statusCard}>
          <View>
            <Text style={styles.statusTitle}>{order.statusLabel}</Text>
            <Text style={styles.statusHint}>{isPending ? "请在剩余时间内完成支付" : "感谢你的支持，祝你游戏愉快"}</Text>
          </View>
          <Text style={styles.statusMark}>{isPending ? "待" : "✓"}</Text>
        </LinearGradient>

        <Section title="服务信息">
          <View style={styles.sellerRow}>
            <Image contentFit="cover" source={order.sellerAvatar} style={styles.avatar} />
            <View style={styles.sellerCopy}><Text style={styles.sellerName}>{order.sellerName}</Text><Text style={styles.muted}>陪玩服务商</Text></View>
          </View>
          <InfoRow label="服务内容" value={order.serviceName} />
          <InfoRow label="游戏" value={order.gameName} />
          <InfoRow label="订单编号" value={`PZ${order.id.replaceAll("-", "").toUpperCase()}20260929`} copy />
        </Section>

        <Section title="费用明细">
          <InfoRow label="服务单价" value={`¥${order.unitPrice}`} />
          <InfoRow label="服务数量" value={`${order.quantity} 小时`} />
          <View style={styles.divider} />
          <View style={styles.totalRow}><Text style={styles.totalLabel}>实付金额</Text><Text style={styles.total}>¥{order.totalPrice}</Text></View>
        </Section>
        <Text style={styles.createdAt}>下单时间 2026-09-29 14:28:06</Text>
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable onPress={() => undefined} style={styles.outlineButton}><Text style={styles.outlineText}>{isPending ? "取消订单" : "申请售后"}</Text></Pressable>
        {isPending && <Pressable onPress={() => undefined}><LinearGradient colors={["#FF1F2E", "#FF1F69"]} style={styles.primaryButton}><Text style={styles.primaryText}>去支付</Text></LinearGradient></Pressable>}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.card}>{children}</View></View>;
}

function InfoRow({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return <View style={styles.infoRow}><Text style={styles.muted}>{label}</Text><View style={styles.infoValue}><Text style={styles.value}>{value}</Text>{copy && <Text style={styles.copy}>复制</Text>}</View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  header: { minHeight: 88, backgroundColor: "#FFF", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  back: { width: 32, alignItems: "flex-start" }, backText: { color: "#111", fontSize: 34, lineHeight: 28, fontWeight: "300" }, headerTitle: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 18, fontWeight: "600" }, headerSlot: { width: 32 },
  content: { padding: 12 }, statusCard: { borderRadius: 12, minHeight: 92, padding: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }, statusTitle: { color: "#E01B28", fontFamily: DOUYIN_SANS, fontSize: 20, fontWeight: "600" }, statusHint: { color: "#A15A5F", fontFamily: DOUYIN_SANS, fontSize: 12, marginTop: 7 }, statusMark: { color: "#FFABB1", fontSize: 42, fontWeight: "700" },
  section: { marginBottom: 12 }, sectionTitle: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 16, fontWeight: "600", marginBottom: 8 }, card: { backgroundColor: "#FFF", borderRadius: 12, padding: 16, gap: 15 }, sellerRow: { flexDirection: "row", alignItems: "center", paddingBottom: 3 }, avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 }, sellerCopy: { gap: 3 }, sellerName: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 15, fontWeight: "600" }, muted: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 12 }, infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 22 }, infoValue: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "70%" }, value: { color: "#333", fontFamily: DOUYIN_SANS, fontSize: 13, textAlign: "right" }, copy: { color: "#E01B28", fontFamily: DOUYIN_SANS, fontSize: 12 }, divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#EEE" }, totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, totalLabel: { color: "#333", fontFamily: DOUYIN_SANS, fontSize: 14 }, total: { color: "#FE1F4C", fontFamily: DOUYIN_SANS, fontSize: 20, fontWeight: "600" }, createdAt: { color: "#AAA", fontFamily: DOUYIN_SANS, fontSize: 11, textAlign: "center", marginTop: 6 },
  bottom: { backgroundColor: "#FFF", paddingHorizontal: 16, paddingTop: 10, flexDirection: "row", justifyContent: "flex-end", gap: 10 }, outlineButton: { minWidth: 92, height: 40, paddingHorizontal: 18, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: "#CCC", alignItems: "center", justifyContent: "center" }, outlineText: { color: "#333", fontFamily: DOUYIN_SANS, fontSize: 13 }, primaryButton: { minWidth: 112, height: 40, paddingHorizontal: 24, borderRadius: 20, alignItems: "center", justifyContent: "center" }, primaryText: { color: "#FFF", fontFamily: DOUYIN_SANS, fontSize: 13, fontWeight: "600" },
});
