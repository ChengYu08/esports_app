import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { queryClient } from "@/core/query/query-client";
import { clientAuthApi } from "@/features/auth/client-auth.api";
import { clearAuthSession } from "@/features/auth/session-persistence";
import { messageStore } from "@/features/message/message-store";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");
const arrowIcon = require("../../../../assets/mine/figma/mine-arrow-right.svg");

export default function BasicSettingsScreen() {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.accessToken);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [clearing, setClearing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const clearCache = () => {
    Alert.alert(
      "清除缓存",
      "将清理可重新下载的图片和列表缓存，不会删除账号、订单或登录信息。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "清除",
          onPress: () => {
            void (async () => {
              setClearing(true);
              try {
                if (Platform.OS !== "web") {
                  const cleared = await Image.clearDiskCache();
                  await Image.clearMemoryCache();
                  if (!cleared) throw new Error("图片缓存暂时无法清理");
                }
                queryClient.clear();
                Alert.alert("清理完成", "缓存已清除");
              } catch (error) {
                Alert.alert(
                  "清理失败",
                  error instanceof Error ? error.message : "请稍后重试",
                );
              } finally {
                setClearing(false);
              }
            })();
          },
        },
      ],
    );
  };

  const logout = () => {
    Alert.alert("退出登录", "确认退出当前账号吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "退出登录",
        style: "destructive",
        onPress: () => {
          if (loggingOut) return;
          void (async () => {
            setLoggingOut(true);
            if (token) void clientAuthApi.logout(token).catch(() => undefined);
            try {
              await clearAuthSession();
            } catch {
              // Local sign-out still completes when secure storage is unavailable.
            }
            clearSession();
            queryClient.clear();
            await messageStore
              .getState()
              .reset()
              .catch(() => undefined);
            router.replace("/");
            setLoggingOut(false);
          })();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, height: insets.top + 44 },
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
        <Text style={styles.headerTitle}>基础设置</Text>
        <View style={styles.headerEnd} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.settingsGroup}>
          <SettingsRow
            label="账号设置"
            onPress={() => router.push("/account-settings")}
          />
          <SettingsRow
            label="账号与安全"
            onPress={() => router.push("/account-security")}
          />
          {/* <SettingsRow label="青少年模式" value="未开启" onPress={() => Alert.alert("青少年模式", "青少年模式设置暂未开放")} /> */}
          {/* <SettingsRow
            label="消息通知"
            onPress={() => Alert.alert("消息通知", "消息通知设置暂未开放")}
          /> */}
          <SettingsRow
            label={clearing ? "正在清理缓存" : "清除缓存"}
            value="可清理"
            disabled={clearing}
            onPress={clearCache}
          />
          <SettingsRow
            label="关于盼之电竞"
            last
            onPress={() => router.push("/about")}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={loggingOut}
          onPress={logout}
          style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
        >
          <Text style={styles.logoutText}>
            {loggingOut ? "正在退出" : "退出登录"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  last,
  disabled,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowDivider,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        <Image source={arrowIcon} style={styles.arrow} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  header: {
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  backButton: { width: 44, height: 44, justifyContent: "center" },
  backIcon: { width: 24, height: 24, tintColor: "#0A0A0A" },
  headerTitle: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontWeight: "600",
    fontSize: 17,
    lineHeight: 24,
  },
  headerEnd: { width: 44 },
  settingsGroup: { marginTop: 8, backgroundColor: "#FFF" },
  row: {
    minHeight: 54,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8E8E8",
  },
  rowLabel: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowValue: {
    color: "#999",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    lineHeight: 20,
  },
  arrow: { width: 18, height: 18 },
  logout: {
    minHeight: 54,
    marginTop: 8,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },
  logoutText: {
    color: "#E11D2A",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  pressed: { backgroundColor: "#F5F5F5" },
});
