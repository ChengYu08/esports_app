import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");
const arrowIcon = require("../../../../assets/mine/figma/mine-arrow-right.svg");

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
      <View
        style={[
          styles.header,
          { height: 44 + insets.top, paddingTop: insets.top },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Image source={backIcon} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.title}>账号与安全</Text>
        <View style={styles.headerEnd} />
      </View>
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
            <Image source={arrowIcon} style={styles.arrow} />
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
  header: {
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 48,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { width: 24, height: 24, tintColor: "#0A0A0A" },
  headerEnd: { width: 16 },
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
    color: "#FF1F4C",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  pressed: { backgroundColor: "#F5F5F5" },
});
