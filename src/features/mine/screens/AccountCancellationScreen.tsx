import { Image } from "expo-image";
import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DOUYIN_SANS } from "@/shared/theme/typography";

const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");

export default function AccountCancellationScreen() {
  const insets = useSafeAreaInsets();
  const requestCancellation = () => Alert.alert("确认注销账号？", "注销后将无法恢复账号，相关资料和未使用权益也可能被清除。", [
    { text: "暂不注销", style: "cancel" },
    { text: "确认注销", style: "destructive", onPress: () => Alert.alert("暂无法提交", "账号注销申请服务正在接入，请联系客服处理。") },
  ]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { height: 44 + insets.top, paddingTop: insets.top }]}>
        <Pressable accessibilityLabel="返回" hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <Image source={backIcon} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>注销账号</Text>
        <View style={styles.headerSpace} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>注销前请确认</Text>
        <Text style={styles.body}>注销账号后，你将无法继续使用盼之电竞账号登录和相关服务。</Text>
        <Text style={styles.body}>账号下的个人资料、消息、订单记录及未使用权益可能会被删除或匿名化，注销完成后无法恢复。</Text>
        <Pressable accessibilityRole="button" onPress={requestCancellation} style={styles.button}>
          <Text style={styles.buttonText}>申请注销账号</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  header: { backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EBEBEB" },
  backButton: { width: 28, height: 28, justifyContent: "center" },
  backIcon: { width: 24, height: 24, tintColor: "#0A0A0A" },
  headerSpace: { width: 28 },
  headerTitle: { color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 17, lineHeight: 24, fontWeight: "600" },
  content: { padding: 20 },
  title: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 18, fontWeight: "600", marginBottom: 16 },
  body: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 14, lineHeight: 24, marginBottom: 12 },
  button: { height: 46, marginTop: 28, borderRadius: 8, backgroundColor: "#FF1F4C", alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#FFF", fontFamily: DOUYIN_SANS, fontSize: 15, fontWeight: "600" },
});
