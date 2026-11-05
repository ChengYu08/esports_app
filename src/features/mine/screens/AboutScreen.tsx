import Constants from "expo-constants";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { showToast } from "@/shared/ui/app-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { APP_LINKS } from "@/core/config/links";
import { useAppUpgradeStore } from "@/features/app-upgrade/app-upgrade.store";
import { openInAppWebView } from "@/shared/navigation/open-web-view";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";

const appIcon = require("../../../../assets/images/icon.png");
const backIcon = require("../../../../assets/svgs/icon-back.svg");
const arrowIcon = require("../../../../assets/svgs/mine-arrow-right.svg");

const VERSION = `v${Constants.expoConfig?.version ?? "1.0.0"}`;

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | undefined>(
    undefined,
  );

  const checkForUpdate = () => {
    if (checking) {
      return;
    }
    setChecking(true);
    setUpdateStatus("检查中...");
    void (async () => {
      try {
        const hasUpdate = await useAppUpgradeStore.getState().checkNow();
        if (!hasUpdate) {
          setUpdateStatus("已是最新版本");
          showToast("当前已是最新版本");
          return;
        }
        setUpdateStatus("发现新版本");
      } catch {
        setUpdateStatus("检查更新失败");
        showToast("检查失败，请稍后重试");
      } finally {
        setChecking(false);
      }
    })();
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="关于盼之电竞"
        onBack={() => router.back()}
        backIcon={backIcon}
        titleStyle={styles.headerTitle}
        style={{
          paddingTop: insets.top,
          height: insets.top + 44,
          paddingHorizontal: 12,
        }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandBlock}>
          <Image
            accessibilityLabel="盼之电竞应用 logo"
            source={appIcon}
            style={styles.appIcon}
          />
          <View style={styles.brandCopy}>
            <Text style={styles.appName}>盼之电竞</Text>
            <Text style={styles.version}>{VERSION}</Text>
          </View>
        </View>

        <View style={styles.list}>
          <AboutRow
            label="检测更新"
            value={checking ? "检查中..." : updateStatus}
            onPress={checkForUpdate}
          />
          <View style={styles.divider} />
          <AboutRow
            label="用户协议"
            onPress={() => openInAppWebView(APP_LINKS.userAgreement, "用户协议")}
          />
          <View style={styles.divider} />
          <AboutRow
            label="隐私政策"
            onPress={() => openInAppWebView(APP_LINKS.privacyPolicy, "隐私政策")}
          />
          <View style={styles.divider} />
        </View>
      </ScrollView>
    </View>
  );
}

function AboutRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      <Image source={arrowIcon} style={styles.arrowIcon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  headerTitle: {
    color: "#0A0A0A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  content: { flexGrow: 1, paddingTop: 48 },
  brandBlock: { alignItems: "center", gap: 16 },
  appIcon: { width: 80, height: 80, borderRadius: 12 },
  brandCopy: { alignItems: "center", gap: 4 },
  appName: {
    color: "#0A0A0A",
    fontSize: 16,
    lineHeight: 22,
  },
  version: {
    color: "#666",
    fontSize: 14,
    lineHeight: 22,
  },
  list: { marginTop: 32, backgroundColor: "#FFF" },
  row: {
    minHeight: 54,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EBEBEB",
    marginHorizontal: 16,
  },
  rowValue: {
    color: "#999999",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
  },
  rowLabel: {
    flex: 1,
    color: "#333",
    fontSize: 14,
    lineHeight: 22,
  },
  arrowIcon: { width: 18, height: 18 },
});
