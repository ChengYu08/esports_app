import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RealNameVerificationSheet } from "@/features/mine/components/RealNameVerificationSheet";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");
const arrowIcon = require("../../../../assets/mine/figma/mine-arrow-right.svg");

export default function AccountSecurityScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const [verifyVisible, setVerifyVisible] = useState(false);
  const phone = user?.phone;
  const maskedPhone = phone
    ? phone.includes("*") ? phone : `${phone.slice(0, 3)} **** ${phone.slice(-4)}`
    : "未绑定";

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { height: 44 + insets.top, paddingTop: insets.top }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={() => router.back()} style={styles.backButton}>
          <Image source={backIcon} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.title}>账号与安全</Text>
        <View style={styles.headerEnd} />
      </View>
      <View style={styles.group}>
        <Pressable accessibilityRole="button" accessibilityLabel="实名认证" onPress={() => user?.isRealName !== 1 && setVerifyVisible(true)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <Text style={styles.label}>实名认证</Text>
          <View style={styles.rowRight}>
            <Text style={styles.value}>{user?.isRealName === 1 ? `已认证（${user.realName || "本人"}）` : "未认证"}</Text>
            <Image source={arrowIcon} style={styles.arrow} />
          </View>
        </Pressable>
        <View style={[styles.row, styles.lastRow]}>
          <Text style={styles.label}>手机号</Text>
          <Text style={styles.value}>{maskedPhone}{phone ? "（已绑定）" : ""}</Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push("/account-cancellation")} style={({ pressed }) => [styles.cancellation, pressed && styles.pressed]}>
        <Text style={styles.cancellationText}>注销账户</Text>
      </Pressable>
      <RealNameVerificationSheet visible={verifyVisible} onClose={() => setVerifyVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  header: { backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  backButton: { width: 44, height: 44, justifyContent: "center" },
  backIcon: { width: 24, height: 24, tintColor: "#0A0A0A" },
  headerEnd: { width: 44 },
  title: { color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 17, lineHeight: 24, fontWeight: "600" },
  group: { marginTop: 8, backgroundColor: "#FFF" },
  row: { minHeight: 54, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E8E8E8", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lastRow: { borderBottomWidth: 0 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  label: { color: "#222", fontFamily: DOUYIN_SANS, fontSize: 14 },
  value: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 13 },
  arrow: { width: 18, height: 18 },
  cancellation: { minHeight: 54, marginTop: 8, backgroundColor: "#FFF", justifyContent: "center", alignItems: "center" },
  cancellationText: { color: "#E11D2A", fontFamily: DOUYIN_SANS, fontSize: 14 },
  pressed: { backgroundColor: "#F5F5F5" },
});
