import { useAuthStore } from "@esports/auth";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { queryClient } from "@/core/query/query-client";
import { clientAuthApi } from "@/features/auth/client-auth.api";
import { clearAuthSession } from "@/features/auth/session-persistence";
import { messageStore } from "@/features/message/message-store";
import { readLastTeenEnabled } from "@/features/mine/teen-mode-store";
import { useSmsNotifyStatus } from "@/features/mine/hooks/use-sms-notify";
import { leaveVoiceRtc } from "@/features/voice-room/voice-room-rtc";
import { leaveVoiceChatRoom } from "@/features/voice-room/voice-room-rongcloud";
import { useVoiceRoomSessionStore } from "@/features/voice-room/voice-room-session";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");
const arrowIcon = require("../../../../assets/mine/figma/mine-arrow-right.svg");

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
  const token = useAuthStore((state) => state.accessToken);
  const clearSession = useAuthStore((state) => state.clearSession);
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
      // 展示最近一次服务端状态镜像；以 /youth/status 拉取结果为准
      readLastTeenEnabled().then((enabled) =>
        setTeenModeEnabled(enabled ?? false),
      );
    }, []),
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
        message: "确认退出当前账号吗？",
        cancelText: "取消",
        confirmText: "退出登录",
      });
      if (!confirmed) return;
      if (loggingOut) return;
      setLoggingOut(true);
      // 顺序对齐 PC 端 user.ts#logout:
      // 1. 用旧 token 先解绑实时资源(语音房 RTC/融云聊天室),再断开 IM
      // 2. 清本地凭证 + 内存
      // 3. 最后并行调 logout API,服务端 token 失效在本地清理之后、跳转之前完成
      try {
        const { activeRoom, joiningRoom, clearActiveRoom } =
          useVoiceRoomSessionStore.getState();
        clearActiveRoom();
        if (activeRoom || joiningRoom) {
          await leaveVoiceRtc().catch(() => undefined);
          const chatroomIds = new Set([
            activeRoom?.rongChatroomId,
            joiningRoom?.rongChatroomId,
          ]);
          await Promise.allSettled(
            [...chatroomIds]
              .filter((id): id is string => Boolean(id))
              .map((id) => leaveVoiceChatRoom(id)),
          );
        }
        await messageStore
          .getState()
          .reset()
          .catch(() => undefined);
      } finally {
        try {
          await clearAuthSession();
        } catch {
          // Local sign-out still completes when secure storage is unavailable.
        }
        clearSession();
        queryClient.clear();
        // 后端 logout 失败不阻塞本地登出;但仍要等其完成,避免新账号拿到未失效的旧 token。
        if (token) {
          await clientAuthApi.logout(token).catch(() => undefined);
        }
        router.replace("/");
        setLoggingOut(false);
      }
    })();
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
  headerTitle: {
    color: "#0A0A0A",
    fontWeight: "500",
    fontSize: 16,
    lineHeight: 24,
  },
  headerEnd: { width: 16 },
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
    fontFamily: DOUYIN_SANS,
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
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    lineHeight: 20,
  },
  cacheSizeValue: {
    color: "#FF1F4C",
    fontFamily: DOUYIN_SANS,
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
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  cacheConfirmText: {
    color: "#FFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.58 },
});
