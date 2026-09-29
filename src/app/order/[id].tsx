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
        <View style={styles.headerTitle} />
        <View style={styles.headerSlot} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 148 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.statusBlock, { height: 84, paddingTop: 12 }]}><Text style={styles.statusTitle}>{isPending ? "待支付" : order.statusLabel === "已支付" ? "进行中" : order.statusLabel}</Text><Text style={[styles.statusHint, { marginTop: 8, lineHeight: 22 }]}>{statusHint}</Text></View>
        <ProgressSteps activeStep={isPending ? 0 : isCompleted ? 4 : 1} />
        <View style={styles.infoBlock}>
          <View style={styles.sellerRow}><Image contentFit="cover" source={order.sellerAvatar} style={styles.avatar} /><View style={styles.sellerCopy}><Text style={styles.sellerName}>{order.sellerName}</Text><Text style={styles.muted}>盼之电竞自营俱乐部</Text></View><Pressable style={styles.chatButton}><Text style={styles.chatText}>聊一聊</Text></Pressable></View>
          <View style={styles.divider} />
          <InfoRow label="游戏" value={order.gameName} />
          <InfoRow label="服务" value={order.serviceName.replace("服务", "")} />
          <InfoRow label="备注" value="-" />
          <InfoRow label="单价" value={`${order.unitPrice}星钻/小时`} />
          <InfoRow label="个数" value={`x ${order.quantity}`} />
          <InfoRow label="实付款" value={`${order.totalPrice}星钻`} />
        </View>
        <View style={styles.infoBlock}><InfoRow label="订单编号" value="8774335191151443968" copy /><InfoRow label="创建时间" value="2026-01-08 09:50:47" /><InfoRow label="支付时间" value="2026-01-08 10:02:04" /></View>
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable onPress={() => undefined} style={styles.outlineButton}><Text style={styles.outlineText}>{isPending ? "取消订单" : "申请售后"}</Text></Pressable>
      </View>
    </View>
  );
}

function ProgressSteps({ activeStep }: { activeStep: number }) { const labels = ["支付订单", "陪玩确认", "陪玩服务", "服务完成"]; return <View style={[styles.steps, { height: 74, paddingBottom: 10 }]}>{labels.map((label, index) => { const done = index < activeStep; const active = index === activeStep; return <View style={styles.step} key={label}><View style={styles.stepLine}><View style={[styles.connector, index === 0 && styles.hidden]} /><View style={[styles.stepDot, done && styles.stepDone, active && styles.stepActive]}><Text style={[styles.stepNumber, (done || active) && styles.stepNumberActive]}>{done ? "✓" : index + 1}</Text></View><View style={[styles.connector, index === labels.length - 1 && styles.hidden]} /></View><Text style={[styles.stepLabel, index > activeStep && styles.stepLabelMuted]}>{label}</Text></View> })}</View>; }

function InfoRow({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return <View style={styles.infoRow}><Text style={styles.label}>{label}</Text><View style={styles.infoValue}><Text style={[styles.value, label === "实付款" && styles.amount]}>{value}</Text>{copy && <Text style={styles.copy}>▣</Text>}</View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF" },
  header: { minHeight: 88, backgroundColor: "#FFF", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  back: { width: 32, alignItems: "flex-start" }, backText: { color: "#111", fontSize: 34, lineHeight: 28, fontWeight: "300" }, headerTitle: { width: 32 }, headerSlot: { width: 32 },
  content: { paddingBottom: 148 }, statusBlock: { height: 158, paddingHorizontal: 16, paddingTop: 100 }, statusTitle: { color: "#161616", fontFamily: DOUYIN_SANS, fontSize: 28, fontWeight: "700", lineHeight: 34 }, statusHint: { color: "#222", fontFamily: DOUYIN_SANS, fontSize: 16, marginTop: 26 }, steps: { height: 112, flexDirection: "row", paddingHorizontal: 32, paddingBottom: 27 }, step: { flex: 1, alignItems: "center" }, stepLine: { width: "100%", height: 28, flexDirection: "row", alignItems: "center" }, connector: { flex: 1, height: 1, backgroundColor: "#E4E4E4" }, hidden: { opacity: 0 }, stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#D1D1D1", alignItems: "center", justifyContent: "center" }, stepDone: { backgroundColor: "#E2FBF1" }, stepActive: { backgroundColor: "#FFE9EE", borderWidth: 7, borderColor: "#FFE9EE" }, stepNumber: { color: "#FFF", fontSize: 14, fontWeight: "600" }, stepNumberActive: { color: "#FF254B" }, stepLabel: { color: "#222", fontFamily: DOUYIN_SANS, fontSize: 13, marginTop: 9 }, stepLabelMuted: { color: "#999" }, infoBlock: { gap: 0, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 14, borderTopColor: "#F7F7F7" }, sellerRow: { flexDirection: "row", alignItems: "center", minHeight: 58 }, avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 }, sellerCopy: { flex: 1, gap: 4 }, sellerName: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 17, fontWeight: "600" }, muted: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 13 }, chatButton: { backgroundColor: "#FF2850", borderRadius: 20, paddingHorizontal: 18, height: 40, alignItems: "center", justifyContent: "center" }, chatText: { color: "#FFF", fontFamily: DOUYIN_SANS, fontSize: 16, fontWeight: "600" }, infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 34 }, label: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 16 }, infoValue: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "70%" }, value: { color: "#161616", fontFamily: DOUYIN_SANS, fontSize: 16, textAlign: "right" }, amount: { color: "#F02543", fontWeight: "600" }, copy: { color: "#999", fontSize: 14 }, divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#EEE", marginVertical: 8 }, bottom: { backgroundColor: "#FFF", paddingHorizontal: 16, paddingTop: 16, flexDirection: "row", justifyContent: "flex-end", borderTopWidth: 14, borderTopColor: "#F7F7F7" }, outlineButton: { width: "100%", height: 42, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: "#E7E7E7", alignItems: "center", justifyContent: "center" }, outlineText: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 17, fontWeight: "600" },
});
