import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { CachedImage } from "@/shared/ui/CachedImage";
import type { AfterSaleMember } from "../order.api";

export function OrderAfterSaleSheet({ visible, loading, members, onClose, onContact }: {
  visible: boolean; loading: boolean; members: AfterSaleMember[]; onClose: () => void; onContact: (member: AfterSaleMember) => void;
}) {
  const insets = useSafeAreaInsets();
  return <BottomSheet scrollable visible={visible} onClose={onClose} contentStyle={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
      <View style={styles.header}><Text style={styles.title}>申请售后</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
      {loading ? <Text style={styles.tip}>加载中...</Text> : members.length === 0 ? <Text style={styles.tip}>暂无售后客服</Text> : members.map((member) => <View style={styles.row} key={member.userId}>
        <CachedImage contentFit="cover" source={member.headImage} style={styles.avatar} /><View style={styles.copy}><Text style={styles.name}>{member.nickname || "售后客服"}</Text><Text style={styles.status}>{Number(member.onlineStatus) === 1 ? "在线中" : "离线"}</Text></View><Pressable style={styles.contact} onPress={() => onContact(member)}><Text style={styles.contactText}>联系</Text></Pressable>
      </View>)}
      <Text style={styles.footer}>如无法解决，可前往小法庭申请平台介入</Text>
  </BottomSheet>;
}

const styles = StyleSheet.create({ sheet: { backgroundColor: "#fff", padding: 20, borderTopLeftRadius: 18, borderTopRightRadius: 18 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }, title: { fontSize: 18, fontWeight: "700", color: "#111" }, close: { fontSize: 28, color: "#777" }, row: { flexDirection: "row", alignItems: "center", paddingVertical: 10 }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#eee" }, copy: { flex: 1, marginLeft: 10 }, name: { fontSize: 15, color: "#111" }, status: { marginTop: 4, fontSize: 12, color: "#999" }, contact: { paddingHorizontal: 18, height: 34, borderRadius: 17, backgroundColor: "#ff3158", justifyContent: "center" }, contactText: { color: "#fff", fontWeight: "600" }, tip: { paddingVertical: 28, color: "#999", textAlign: "center" }, footer: { marginTop: 16, color: "#999", fontSize: 12, textAlign: "center" } });
