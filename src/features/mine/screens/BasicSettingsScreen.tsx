import { Delete24Regular } from "@fluentui/react-native-icons";
import { Paths } from "expo-file-system";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { showToast } from "@/shared/ui/app-toast";
import { useAppConfirm } from "@/shared/ui/app-confirm";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { queryClient } from "@/core/query/query-client";
import {
  getLogoutConfirmMessage,
  signOut,
} from "@/features/auth/sign-out";
import { useAuthStore } from "@esports/auth";
import { readLastTeenEnabled } from "@/features/mine/teen-mode-store";
import { useSmsNotifyStatus } from "@/features/mine/hooks/use-sms-notify";

const backIcon = require("../../../../assets/svgs/icon-back.svg");
const arrowIcon = require("../../../../assets/svgs/mine-arrow-right.svg");

function readCacheSize() {
  if (Platform.OS === "web") return 0;
  try {
    return Math.max(0, Paths.cache.size ?? 0);
  } catch {
    return null;
  }
}

function formatBytes(bytes: number | null) {
  if (bytes === null) return "暂不可用";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function BasicSettingsScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [clearing, setClearing] = useState(false);
  const [cacheModalVisible, setCacheModalVisible] = useState(false);
  const [cacheSize, setCacheSize] = useState<number | null>(() =>
    readCacheSize(),
  );
  const [loggingOut, setLoggingOut] = useState(false);
  const [teenModeEnabled, setTeenModeEnabled] = useState(false);

  // 提前预热短信通知开关缓存，进入消息通知页时无需再等待加载
  useSmsNotifyStatus();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setTeenModeEnabled(false);
      // 展示最近一次服务端状态镜像；以 /youth/status 拉取结果为准
      readLastTeenEnabled(userId).then((enabled) => {
        if (active) {
          setTeenModeEnabled(enabled ?? false);
        }
      });
      return () => {
        active = false;
      };
    }, [userId]),
  );

  const clearCache = () => setCacheModalVisible(true);

  const confirmClearCache = () => {
    if (clearing) return;
    setCacheModalVisible(false);
    void (async () => {
      setClearing(true);
      try {
        if (Platform.OS !== "web") {
          const cleared = await Image.clearDiskCache();
          await Image.clearMemoryCache();
          if (!cleared) throw new Error("图片缓存暂时无法清理");
        }
        queryClient.clear();
        setCacheSize(readCacheSize());
        showToast("清理完成，可重新下载的缓存已清除");
      } catch (error) {
        showToast(
          `清理失败，${error instanceof Error ? error.message : "请稍后重试"}`,
        );
        setCacheSize(readCacheSize());
      } finally {
        setClearing(false);
      }
    })();
  };

  const logout = () => {
    void (async () => {
      const confirmed = await useAppConfirm.getState().confirm({
        title: "退出登录",
        message: getLogoutConfirmMessage(userId),
        cancelText: "取消",
        confirmText: "退出登录",
      });
      if (!confirmed) {
        return;
      }
      if (loggingOut) {
        return;
      }
      setLoggingOut(true);
      try {
        await signOut();
      } finally {
        router.replace("/");
        setLoggingOut(false);
      }
    })();
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="基础设置"
        onBack={() => router.back()}
        backIcon={backIcon}
        titleStyle={styles.headerTitle}
        style={{ paddingTop: insets.top, height: insets.top + 44 }}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.settingsGroup}>
          <SettingsRow
            label="账号与安全"
            onPress={() => router.push("/account-security")}
          />
          <SettingsRow
            label="青少年模式"
            value={teenModeEnabled ? "已开启" : "未开启"}
            onPress={() => router.push("/teen-mode")}
          />
          <SettingsRow
            label="消息通知"
            onPress={() => router.push("/message-notification")}
          />
          <SettingsRow
            label={clearing ? "正在清理缓存" : "清除缓存"}
            value={formatBytes(cacheSize)}
            disabled={clearing}
            onPress={clearCache}
          />
          <SettingsRow
            label="关于盼之电竞"
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
      <Modal
        animationType="fade"
        transparent
        visible={cacheModalVisible}
        onRequestClose={() => setCacheModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel="关闭清除缓存弹窗"
            onPress={() => setCacheModalVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.cacheModalCard}>
            <View style={styles.cacheModalIcon}>
              <Delete24Regular color="#FF1F4C" height={24} width={24} />
            </View>
            <Text style={styles.cacheModalTitle}>清除缓存</Text>
            <Text style={styles.cacheModalMessage}>
              将清理可重新下载的图片和列表缓存，不会影响账号、订单或登录信息。
            </Text>
            <View style={styles.cacheSizePanel}>
              <Text style={styles.cacheSizeLabel}>可清理文件</Text>
              <Text style={styles.cacheSizeValue}>
                {formatBytes(cacheSize)}
              </Text>
            </View>
            <View style={styles.cacheModalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setCacheModalVisible(false)}
                style={({ pressed }) => [
                  styles.cacheCancelButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.cacheCancelText}>取消</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={clearing}
                onPress={confirmClearCache}
                style={({ pressed }) => [
                  styles.cacheConfirmButton,
                  pressed && styles.buttonPressed,
                  clearing && styles.buttonDisabled,
                ]}
              >
                {clearing ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.cacheConfirmText}>立即清理</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  disabled,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Text style={styles.rowLabel}>{label}</Text>
        <View style={styles.rowRight}>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
          <Image source={arrowIcon} style={styles.arrow} />
        </View>
      </Pressable>
      <View style={styles.rowDivider} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  headerTitle: {
    color: "#0A0A0A",
    fontWeight: "500",
    fontSize: 16,
    lineHeight: 24,
  },
  settingsGroup: { marginTop: 8, backgroundColor: "#FFF" },
  row: {
    minHeight: 54,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EBEBEB",
    marginLeft: 16,
  },
  rowLabel: {
    color: "#333333",
    fontSize: 14,
    lineHeight: 22,
  },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowValue: {
    color: "#666666",
    fontSize: 14,
    lineHeight: 22,
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
    color: "#FF1F4C",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  pressed: { backgroundColor: "#F5F5F5" },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  cacheModalCard: {
    width: "100%",
    maxWidth: 348,
    borderRadius: 16,
    padding: 22,
    backgroundColor: "#FFF",
  },
  cacheModalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0F2",
    alignSelf: "center",
  },
  cacheModalTitle: {
    marginTop: 14,
    color: "#111216",
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "600",
    textAlign: "center",
  },
  cacheModalMessage: {
    marginTop: 8,
    color: "#666",
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
  },
  cacheSizePanel: {
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    backgroundColor: "#F8F8F8",
  },
  cacheSizeLabel: {
    color: "#666",
    fontSize: 13,
    lineHeight: 20,
  },
  cacheSizeValue: {
    color: "#FF1F4C",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  cacheModalActions: { marginTop: 22, flexDirection: "row", gap: 10 },
  cacheCancelButton: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
  },
  cacheConfirmButton: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#FF1F4C",
  },
  cacheCancelText: {
    color: "#555",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  cacheConfirmText: {
    color: "#FFF",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.58 },
});
