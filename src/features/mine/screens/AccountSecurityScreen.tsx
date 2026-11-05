import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/shared/ui/ScreenHeader";

const backIcon = require("../../../../assets/svgs/icon-back.svg");
const arrowIcon = require("../../../../assets/svgs/mine-arrow-right.svg");

export default function AccountSecurityScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const phone = user?.phone;
  const maskedPhone = phone
    ? phone.includes("*")
      ? phone
      : `${phone.slice(0, 3)} **** ${phone.slice(-4)}`
    : "未绑定";

  const openRealNameVerification = () => {
    router.push("/real-name-verification");
  };

  const openChangePassword = () => {
    router.push("/change-password");
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="账号与安全"
        onBack={() => router.back()}
        backIcon={backIcon}
        titleStyle={styles.title}
        style={{ paddingTop: insets.top, height: insets.top + 44 }}
      />
      <View style={styles.group}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="实名认证"
          onPress={openRealNameVerification}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.label}>实名认证</Text>
          <View style={styles.rowRight}>
            <Text
              style={
                user?.isRealName === 1
                  ? styles.value
                  : styles.valuePlaceholder
              }
            >
              {user?.isRealName === 1
                ? `已认证（${user.realName || "本人"}）`
                : "未认证"}
            </Text>
            {user?.isRealName !== 1 ? (
              <Image source={arrowIcon} style={styles.arrow} />
            ) : null}
          </View>
        </Pressable>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>手机号</Text>
          <Text style={styles.value}>
            {maskedPhone}
            {phone ? "（已绑定）" : ""}
          </Text>
        </View>
        <View style={styles.divider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="修改密码"
          onPress={openChangePassword}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.label}>修改密码</Text>
          <View style={styles.rowRight}>
            <Image source={arrowIcon} style={styles.arrow} />
          </View>
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="黑名单"
          onPress={() => router.push("/blacklist")}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.label}>黑名单</Text>
          <View style={styles.rowRight}>
            <Image source={arrowIcon} style={styles.arrow} />
          </View>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/account-cancellation")}
        style={({ pressed }) => [
          styles.cancellation,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.cancellationText}>注销账户</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  title: {
    color: "#0A0A0A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  group: { marginTop: 8, backgroundColor: "#FFF" },
  row: {
    minHeight: 54,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EBEBEB",
    marginHorizontal: 16,
  },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  label: {
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
  },
  value: { color: "#666666", fontSize: 14, lineHeight: 22 },
  valuePlaceholder: { color: "#CCCCCC", fontSize: 14, lineHeight: 22 },
  arrow: { width: 18, height: 18 },
  cancellation: {
    minHeight: 54,
    marginTop: 8,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },
  cancellationText: {
    color: "#FE1F4C",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  pressed: { backgroundColor: "#F5F5F5" },
});
