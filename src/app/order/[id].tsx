import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import { ORDER_ITEMS } from "@/features/order/order.data";

export default function OrderDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const order = ORDER_ITEMS.find((item) => item.id === id) ?? ORDER_ITEMS[0];
  const isPending = order.status === "pendingPayment";
  const isCompleted = order.status === "completed";
  const statusHint = isPending ? "请在剩余时间内完成支付" : isCompleted ? "感谢你的支持" : "陪玩 2分41秒 内确认订单并开始服务";

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
        <View style={styles.statusBlock}><View style={styles.statusLine}><Text style={styles.statusIcon}>◷</Text><Text style={styles.statusTitle}>{isPending ? "待支付" : order.statusLabel === "已支付" ? "进行中" : order.statusLabel}</Text></View><Text style={styles.statusHint}>{statusHint}</Text></View>
        <ProgressSteps completed={isCompleted} />
        <View style={styles.infoBlock}>
          <View style={styles.sellerRow}><Image contentFit="cover" source={order.sellerAvatar} style={styles.avatar} /><View style={styles.sellerCopy}><Text style={styles.sellerName}>{order.sellerName}</Text><Text style={styles.muted}>盼之电竞自营俱乐部</Text></View><Pressable style={styles.chatButton}><Text style={styles.chatText}>聊一聊</Text></Pressable></View>
          <View style={styles.divider} />
          <InfoRow label="游戏" value={order.gameName} copy />
          <InfoRow label="服务" value={order.serviceName.replace("服务", "")} copy />
          <InfoRow label="备注" value="-" copy />
          <InfoRow label="单价" value={`${order.unitPrice}星钻/小时`} copy />
          <InfoRow label="个数" value={`x ${order.quantity}`} copy />
          <InfoRow label="实付款" value={`${order.totalPrice}星钻`} copy />
        </View>
        <View style={styles.infoBlock}><InfoRow label="订单编号" value="8774335191151443968" copy /><InfoRow label="创建时间" value="2026-01-08 09:50:47" /><InfoRow label="支付时间" value="2026-01-08 10:02:04" /><InfoRow label="交易完成时间" value="2026-01-12 13:40:44" /></View>
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable onPress={() => undefined} style={styles.outlineButton}><Text style={styles.outlineText}>{isPending ? "取消订单" : "申请售后"}</Text></Pressable>
      </View>
    </View>
  );
}

function ProgressSteps({ completed }: { completed: boolean }) { const labels = ["支付订单", "陪玩确认", "陪玩服务", "服务完成", "财务放款", "交易完成"]; return <View style={styles.steps}>{labels.map((label, index) => <View style={styles.step} key={label}><View style={styles.stepLine}><View style={[styles.connector, index === 0 && styles.hidden]} /><View style={[styles.stepDot, (index === 0 || completed) && styles.stepDone]}><Text style={styles.stepNumber}>{index === 0 || completed ? "✓" : index + 1}</Text></View><View style={[styles.connector, index === labels.length - 1 && styles.hidden]} /></View><Text style={styles.stepLabel}>{label}</Text></View>)}</View>; }

function InfoRow({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return <View style={styles.infoRow}><Text style={styles.label}>{label}</Text><View style={styles.infoValue}><Text style={styles.value}>{value}</Text>{copy && <Text style={styles.copy}>▣</Text>}</View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF" },
  header: { minHeight: 88, backgroundColor: "#FFF", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  back: { width: 32, alignItems: "flex-start" }, backText: { color: "#111", fontSize: 34, lineHeight: 28, fontWeight: "300" }, headerTitle: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 18, fontWeight: "600" }, headerSlot: { width: 32 },
  content: { paddingHorizontal: 16, paddingBottom: 24 }, statusBlock: { paddingVertical: 16 }, statusLine: { flexDirection: "row", alignItems: "center", gap: 8 }, statusIcon: { color: "#FF334F", fontSize: 25 }, statusTitle: { color: "#161616", fontFamily: DOUYIN_SANS, fontSize: 20, fontWeight: "600" }, statusHint: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 12, marginTop: 8, marginLeft: 32 }, steps: { flexDirection: "row", marginHorizontal: -16, paddingBottom: 18 }, step: { flex: 1, alignItems: "center" }, stepLine: { width: "100%", height: 24, flexDirection: "row", alignItems: "center" }, connector: { flex: 1, height: 1, backgroundColor: "#D9D9D9" }, hidden: { opacity: 0 }, stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center" }, stepDone: { backgroundColor: "#FF3150" }, stepNumber: { color: "#999", fontSize: 11 }, stepLabel: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 11, marginTop: 7 }, infoBlock: { gap: 0, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EEE" }, sellerRow: { flexDirection: "row", alignItems: "center", minHeight: 54 }, avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10 }, sellerCopy: { flex: 1, gap: 3 }, sellerName: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 15, fontWeight: "600" }, muted: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 12 }, chatButton: { borderWidth: 1, borderColor: "#DDD", borderRadius: 13, paddingHorizontal: 12, paddingVertical: 4 }, chatText: { color: "#333", fontFamily: DOUYIN_SANS, fontSize: 12 }, infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 34 }, label: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 13 }, infoValue: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "68%" }, value: { color: "#333", fontFamily: DOUYIN_SANS, fontSize: 13, textAlign: "right" }, copy: { color: "#999", fontSize: 13 }, divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#EEE", marginVertical: 8 }, bottom: { backgroundColor: "#FFF", paddingHorizontal: 16, paddingTop: 10, flexDirection: "row", justifyContent: "flex-end" }, outlineButton: { minWidth: 343, height: 42, paddingHorizontal: 18, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, borderColor: "#CCC", alignItems: "center", justifyContent: "center" }, outlineText: { color: "#333", fontFamily: DOUYIN_SANS, fontSize: 13 },
});
