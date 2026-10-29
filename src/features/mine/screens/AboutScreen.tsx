import Constants from "expo-constants";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Toast from "react-native-root-toast";

import { APP_LINKS } from "@/core/config/links";
import { useAppUpgradeStore } from "@/features/app-upgrade/app-upgrade.store";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { openExternalLink } from "@/shared/navigation/open-external-link";

const appIcon = require("../../../../assets/images/icon.png");
const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");
const arrowIcon = require("../../../../assets/mine/figma/mine-arrow-right.svg");

const VERSION = `v${Constants.expoConfig?.version ?? "1.0.0"}`;

export default function AboutScreen() {
  const insets = useSafeAreaInsets();

  const checkForUpdate = () => {
    void (async () => {
      try {
        const hasUpdate = await useAppUpgradeStore.getState().checkNow();
        if (!hasUpdate) {
          Toast.show("当前已是最新版本", { duration: Toast.durations.SHORT });
        }
      } catch {
        Toast.show("检查失败，请稍后重试", { duration: Toast.durations.SHORT });
      }
    })();
  };

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, height: 44 + insets.top },
        ]}
      >
        <Pressable
          accessibilityLabel="返回"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Image source={backIcon} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>关于盼之电竞</Text>
        <View style={styles.headerSpace} />
      </View>

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
          {Platform.OS === "android" && (
            <>
              <AboutRow label="检测更新" onPress={checkForUpdate} />
              <View style={styles.divider} />
            </>
          )}
          <AboutRow
            label="用户协议"
            onPress={() => void openExternalLink(APP_LINKS.userAgreement)}
          />
          <View style={styles.divider} />
          <AboutRow
            label="隐私政策"
            onPress={() => void openExternalLink(APP_LINKS.privacyPolicy)}
          />
          <View style={styles.divider} />
        </View>
      </ScrollView>
    </View>
  );
}

function AboutRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Image source={arrowIcon} style={styles.arrowIcon} />
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
    paddingHorizontal: 12,
  },
  backButton: {
    width: 32,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { width: 24, height: 24, tintColor: "#0A0A0A" },
  headerTitle: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  headerSpace: { width: 32 },
  content: { flexGrow: 1, paddingTop: 48 },
  brandBlock: { alignItems: "center", gap: 16 },
  appIcon: { width: 80, height: 80, borderRadius: 12 },
  brandCopy: { alignItems: "center", gap: 4 },
  appName: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 22,
  },
  version: {
    color: "#666",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  list: { marginTop: 32, paddingVertical: 8, backgroundColor: "#FFF" },
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
  rowLabel: {
    flex: 1,
    color: "#333",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  arrowIcon: { width: 18, height: 18 },
});
