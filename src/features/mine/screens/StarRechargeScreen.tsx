import { DOUYIN_SANS } from "@/shared/theme/typography";
import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchStarBalance } from "@/features/mine/api/companion-order.api";
import { AppPrompt } from "@/shared/ui/AppPrompt";

const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");
const diamondIcon = require("../../../../assets/mine/figma/star-recharge-diamond-3f6fcf.png");

// The Figma frame shows six cards using the same 300-star / ¥30 option.
const rechargePackages = Array.from({ length: 6 }, (_, index) => ({
  id: index,
  diamonds: 300,
  price: 30,
}));

function formatAmount(value: number): string {
  return value.toLocaleString("zh-CN");
}

export default function StarRechargeScreen() {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.accessToken);
  const profileBalance = useAuthStore((state) => state.user?.starBalance);
  const route = useLocalSearchParams<{ shortfall?: string | string[] }>();
  const rawShortfall = Array.isArray(route.shortfall)
    ? route.shortfall[0]
    : route.shortfall;
  const parsedShortfall = Number(rawShortfall);
  const shortfall =
    Number.isFinite(parsedShortfall) && parsedShortfall > 0
      ? parsedShortfall
      : null;
  const parsedProfileBalance =
    profileBalance === undefined ? null : Number(profileBalance);
  const [balance, setBalance] = useState<number | null>(() =>
    parsedProfileBalance !== null && Number.isFinite(parsedProfileBalance)
      ? parsedProfileBalance
      : null,
  );
  const [selectedPackageId, setSelectedPackageId] = useState(3);
  const [agreementAccepted, setAgreementAccepted] = useState(true);
  const [prompt, setPrompt] = useState<{
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void fetchStarBalance(token)
      .then((nextBalance) => {
        if (active) setBalance(nextBalance);
      })
      .catch(() => {
        // Keep the last known profile balance if refreshing fails.
      });
    return () => {
      active = false;
    };
  }, [token]);

  const selectedPackage = rechargePackages[selectedPackageId];

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          { height: insets.top + 44, paddingTop: insets.top },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.headerSide}
        >
          <Image source={backIcon} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>星钻充值</Text>
        <View style={styles.headerSide} />
      </View>

      <View style={styles.balanceSection}>
        <Text style={styles.balanceLabel}>我的星钻余额</Text>
        <Text style={styles.balanceValue}>
          {balance === null ? "--" : formatAmount(balance)}
        </Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          { paddingBottom: insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.optionsSection}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>请选择购买数量</Text>
            <Text style={styles.sectionDescription}>
              {shortfall ? (
                <>
                  还需充值{" "}
                  <Text style={styles.shortfallValue}>
                    {formatAmount(shortfall)}星钻
                  </Text>{" "}
                  以购买本次服务
                </>
              ) : (
                "星钻可用于平台服务消费"
              )}
            </Text>
          </View>

          <View style={styles.packageGrid}>
            {[rechargePackages.slice(0, 3), rechargePackages.slice(3)].map(
              (row, rowIndex) => (
                <View key={rowIndex} style={styles.packageRow}>
                  {row.map((item) => (
                    <RechargeOption
                      key={item.id}
                      diamonds={item.diamonds}
                      price={item.price}
                      selected={selectedPackageId === item.id}
                      onPress={() => setSelectedPackageId(item.id)}
                    />
                  ))}
                </View>
              ),
            )}
          </View>
        </View>

        <View style={styles.purchaseFooter}>
          <View style={styles.agreementRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="同意盼之电竞购买须知"
              accessibilityState={{ checked: agreementAccepted }}
              hitSlop={6}
              onPress={() => setAgreementAccepted((accepted) => !accepted)}
              style={styles.checkboxHitArea}
            >
              <View
                style={[
                  styles.checkbox,
                  agreementAccepted && styles.checkboxSelected,
                ]}
              >
                {agreementAccepted ? (
                  <Text style={styles.checkboxMark}>✓</Text>
                ) : null}
              </View>
            </Pressable>
            <Text style={styles.agreementCopy}>支付即同意</Text>
            <Pressable
              accessibilityRole="link"
              onPress={() =>
                setPrompt({
                  title: "盼之电竞购买须知",
                  message: "请在支付前确认本次充值的星钻数量与金额。",
                })
              }
            >
              <Text style={styles.agreementLink}>《盼之电竞购买须知》</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!agreementAccepted}
            onPress={() =>
              setPrompt({
                title: "暂未接入支付",
                message: "移动端支付流程尚未接入，当前不会创建充值订单。",
              })
            }
            style={styles.confirmButton}
          >
            <LinearGradient
              colors={["#FF1F2E", "#FF1F69"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.confirmGradient,
                !agreementAccepted && styles.confirmDisabled,
              ]}
            >
              <Text style={styles.confirmText}>
                确认支付 ¥{selectedPackage.price}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>

      <AppPrompt
        visible={prompt !== null}
        title={prompt?.title ?? "提示"}
        message={prompt?.message ?? ""}
        onConfirm={() => setPrompt(null)}
      />
    </View>
  );
}

function RechargeOption({
  diamonds,
  price,
  selected,
  onPress,
}: {
  diamonds: number;
  price: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${diamonds} 星钻，${price} 元`}
      onPress={onPress}
      style={[styles.packageCard, selected && styles.packageCardSelected]}
    >
      <View style={styles.packageAmount}>
        <Image
          source={diamondIcon}
          contentFit="contain"
          style={styles.packageIcon}
        />
        <Text style={[styles.packageDiamonds, selected && styles.selectedText]}>
          {diamonds}
        </Text>
      </View>
      <Text style={[styles.packagePrice, selected && styles.selectedText]}>
        ¥{price}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF2F5",
  },
  headerSide: {
    width: 48,
    height: 44,
    paddingLeft: 12,
    justifyContent: "center",
  },
  backIcon: { width: 24, height: 24 },
  headerTitle: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  balanceSection: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  balanceLabel: {
    color: "#999999",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  balanceValue: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  body: { flex: 1 },
  bodyContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  optionsSection: { gap: 12 },
  sectionHeading: { gap: 4 },
  sectionTitle: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  sectionDescription: {
    color: "#808080",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  shortfallValue: { color: "#3DA5FF" },
  packageGrid: { gap: 12 },
  packageRow: { flexDirection: "row", gap: 12 },
  packageCard: {
    flex: 1,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  packageCardSelected: {
    borderColor: "#FF707A",
    backgroundColor: "#FFF5F5",
  },
  packageAmount: { flexDirection: "row", alignItems: "center", gap: 4 },
  packageIcon: { width: 16, height: 16 },
  packageDiamonds: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  packagePrice: {
    color: "#666666",
    fontSize: 12,
    lineHeight: 18,
  },
  selectedText: { color: "#FF4754" },
  purchaseFooter: { gap: 10, paddingVertical: 8, alignItems: "center" },
  agreementRow: {
    minHeight: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  checkboxHitArea: { width: 16, height: 18, justifyContent: "center" },
  checkbox: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D0D0D0",
    borderRadius: 3,
  },
  checkboxSelected: { borderColor: "#3DA5FF", backgroundColor: "#3DA5FF" },
  checkboxMark: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "700",
  },
  agreementCopy: {
    color: "#ABABAD",
    fontFamily: DOUYIN_SANS,
    fontSize: 11,
    lineHeight: 18,
  },
  agreementLink: {
    color: "#3DA5FF",
    fontFamily: DOUYIN_SANS,
    fontSize: 11,
    lineHeight: 18,
  },
  confirmButton: { alignSelf: "stretch", overflow: "hidden", borderRadius: 21 },
  confirmGradient: {
    height: 42,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmDisabled: { opacity: 0.45 },
  confirmText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
});
