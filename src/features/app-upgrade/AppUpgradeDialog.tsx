import Constants from "expo-constants";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";

import { useAppUpgradeStore } from "./app-upgrade.store";

const BRAND = "#FE1F4C";
const APP_CURRENT_VERSION = Constants.expoConfig?.version ?? "1.0.0";

export function AppUpgradeDialog() {
  const {
    visible,
    forceUpdate,
    latest,
    downloadPhase,
    downloadErrorType,
    downloadProgress,
    closeDialog,
    confirmUpdate,
    resetDownload,
    openPermissionSettings,
  } = useAppUpgradeStore();

  if (!visible) return null;

  const isIos = Platform.OS === "ios";
  const busy = downloadPhase === "downloading" || downloadPhase === "installing";
  const buttonLabel = isIos
    ? "去 App Store 更新"
    : downloadPhase === "downloading"
      ? `正在下载 ${downloadProgress}%`
      : downloadPhase === "installing"
        ? "正在启动安装…"
        : downloadPhase === "need-permission"
          ? "去开启安装权限"
          : downloadPhase === "error"
            ? "重新下载"
            : "立即更新";
  const updateContent = latest?.updateContent?.trim() ?? "";

  const requestClose = () => {
    if (!forceUpdate && !busy) closeDialog();
  };

  const handleConfirm = () => {
    if (isIos) {
      void confirmUpdate();
      return;
    }
    if (downloadPhase === "need-permission") {
      openPermissionSettings();
      return;
    }
    if (downloadPhase === "error") {
      resetDownload();
    }
    void confirmUpdate();
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={requestClose}>
      <Pressable style={styles.backdrop} onPress={requestClose}>
        <Pressable style={styles.dialog} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>检查到新版本</Text>
          <View style={styles.body}>
            <Text style={styles.versionRow}>
              当前版本：{APP_CURRENT_VERSION}
            </Text>
            <Text style={styles.versionRow}>
              最新版本：{latest?.versionNo ?? ""}
            </Text>
            <Text style={styles.sectionLabel}>更新内容：</Text>
            <ScrollView style={styles.updateContentScroll} nestedScrollEnabled>
              <Text style={styles.updateContent}>{updateContent}</Text>
            </ScrollView>
            {downloadPhase === "error" && !isIos && (
              <Text style={styles.errorText}>
                {downloadErrorType === "integrity"
                  ? "安装包校验失败，已删除损坏文件，请重新下载"
                  : "下载失败，请检查网络后重试"}
              </Text>
            )}
            {downloadPhase === "need-permission" && (
              <Text style={styles.errorText}>
                未获得安装权限，无法安装新版本，请开启后重试
              </Text>
            )}
          </View>
          <View style={styles.actions}>
            {!forceUpdate && !busy && (
              <Pressable
                accessibilityRole="button"
                style={styles.cancelButton}
                onPress={closeDialog}
              >
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.confirmButton,
                busy && styles.confirmButtonBusy,
                pressed && !busy && styles.confirmButtonPressed,
              ]}
            >
              <Text style={styles.confirmText}>{buttonLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  dialog: {
    width: "86%",
    maxWidth: 360,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  title: {
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
    textAlign: "center",
    paddingTop: 20,
  },
  body: {
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  versionRow: {
    color: "#666666",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  sectionLabel: {
    color: "#666666",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 4,
  },
  updateContentScroll: { maxHeight: 160, flexGrow: 0 },
  updateContent: {
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  errorText: {
    color: BRAND,
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  cancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND,
    paddingHorizontal: 16,
  },
  cancelText: {
    color: BRAND,
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
    textAlign: "center",
  },
  confirmButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND,
    paddingHorizontal: 16,
  },
  confirmButtonBusy: { opacity: 0.6 },
  confirmButtonPressed: { opacity: 0.85 },
  confirmText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
    textAlign: "center",
  },
});
