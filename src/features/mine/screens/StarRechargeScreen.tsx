import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { useStarIap } from "@/features/iap/use-star-iap";
import { fetchStarBalance } from "@/features/mine/api/companion-order.api";
import { APP_LINKS } from "@/core/config/links";
import { openExternalLink } from "@/shared/navigation/open-external-link";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { Skeleton } from "@/shared/ui/Skeleton";

const headerBg = require("../../../../assets/mine/figma/star-recharge-bg.webp");
const diamondIcon = require("../../../../assets/mine/figma/star-recharge-diamond.png");

const SCREEN_WIDTH = Dimensions.get("window").width;
const HEADER_BG_HEIGHT = (SCREEN_WIDTH * 552) / 750;
const GRID_GAP = 8;
const GRID_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

function formatAmount(value: number): string {
  return value.toLocaleString("zh-CN");
}

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15.9078 19.0673C16.2298 19.3895 16.2299 19.9112 15.9078 20.2333C15.5857 20.5553 15.0639 20.5553 14.7418 20.2333L7.47762 12.9692C6.94244 12.4336 6.94218 11.5652 7.47762 11.0297L14.7418 3.76701C15.064 3.44483 15.5856 3.44483 15.9078 3.76701C16.23 4.08919 16.23 4.61084 15.9078 4.93303L8.84286 11.9994L15.9078 19.0673Z"
        fill="#0D0D0F"
      />
    </Svg>
  );
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
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    null,
  );
  const [userTouchedSelection, setUserTouchedSelection] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(true);
  const [prompt, setPrompt] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const refreshBalance = useCallback(() => {
    if (!token) {
      return;
    }
    fetchStarBalance(token)
      .then(setBalance)
      .catch(() => {
        // Keep the last known balance when the refresh is unavailable.
      });
  }, [token]);

  const handleDelivered = useCallback(() => {
    // 到账以服务端钱包为准，重新拉取余额。
    refreshBalance();
    setPrompt({
      title: "充值成功",
      message: "星钻已到账，可用于平台服务消费。",
    });
  }, [refreshBalance]);

  const handlePending = useCallback(() => {
    setPrompt({
      title: "充值处理中",
      message: "系统将自动补发，请稍后查询星钻余额。",
    });
  }, []);

  const {
    packages,
    products,
    status: iapStatus,
    errorMessage: iapErrorMessage,
    purchase,
    clearError,
  } = useStarIap({
    token,
    onDelivered: handleDelivered,
    onPending: handlePending,
  });

  useEffect(() => {
    if (!token) {
      return;
    }
    let active = true;
    fetchStarBalance(token)
      .then((nextBalance) => {
        if (active) {
          setBalance(nextBalance);
        }
      })
      .catch(() => {
        // Keep the last known profile balance if refreshing fails.
      });
    return () => {
      active = false;
    };
  }, [token]);

  const packagesLoading = packages.length === 0;

  const userSelectedValid =
    userTouchedSelection &&
    selectedPackageId !== null &&
    packages.some((item) => item.productId === selectedPackageId);
  const selectedPackage = userSelectedValid
    ? packages.find((item) => item.productId === selectedPackageId)
    : (packages[1] ?? packages[0]);
  const selectedStoreProduct = products.find(
    (product) => product.id === selectedPackage?.productId,
  );
  const purchaseDisabled =
    !agreementAccepted ||
    selectedStoreProduct === undefined ||
    iapStatus === "purchasing" ||
    iapStatus === "verifying";

  function handleConfirmPurchase() {
    if (!agreementAccepted || !selectedPackage) {
      return;
    }

    if (!selectedStoreProduct) {
      setPrompt({
        title: "商品暂不可用",
        message: "苹果内购商品尚未加载完成，请稍后重试。",
      });
      return;
    }

    clearError();
    purchase(selectedPackage.productId).catch((error: unknown) => {
      setPrompt({
        title: "购买失败",
        message:
          error instanceof Error ? error.message : "购买失败，请稍后重试",
      });
    });
  }

  return (
    <View style={styles.screen}>
      <Image
        source={headerBg}
        contentFit="cover"
        style={[styles.headerBg, { height: HEADER_BG_HEIGHT }]}
      />

      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.headerSide}
        >
          <BackIcon />
        </Pressable>
        <Text style={styles.headerTitle}>星钻充值</Text>
        <View style={styles.headerSide} />
      </View>

      <View style={styles.balanceSection}>
        <Text style={styles.balanceValue}>
          {balance === null ? "--" : formatAmount(balance)}
        </Text>
        <Text style={styles.balanceLabel}>我的星钻余额</Text>
      </View>

      <View style={styles.contentSection}>
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
          {packagesLoading
            ? [0, 1, 2, 3, 4, 5].map((index) => (
                <Skeleton
                  key={index}
                  width={CARD_WIDTH}
                  height={74}
                  radius={8}
                />
              ))
            : packages.map((item) => {
                const storeProduct = products.find(
                  (product) => product.id === item.productId,
                );
                return (
                  <RechargeOption
                    key={item.productId}
                    diamonds={item.stars}
                    price={storeProduct?.displayPrice ?? "--"}
                    selected={selectedPackage?.productId === item.productId}
                    onPress={() => {
                      setSelectedPackageId(item.productId);
                      setUserTouchedSelection(true);
                    }}
                  />
                );
              })}
        </View>
      </View>

      <View
        style={[
          styles.purchaseFooter,
          { paddingBottom: insets.bottom + 8 },
        ]}
      >
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
          <Text style={styles.agreementCopy}>
            支付即同意
            <Text
              style={styles.agreementLink}
              onPress={() =>
                void openExternalLink(APP_LINKS.rechargeAgreement)
              }
            >
              《盼之电竞购买须知》
            </Text>
            及其他相关协议
          </Text>
        </View>

        {iapErrorMessage ? (
          <Text style={styles.purchaseError}>{iapErrorMessage}</Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: purchaseDisabled }}
          disabled={purchaseDisabled}
          onPress={handleConfirmPurchase}
          style={[
            styles.confirmButton,
            purchaseDisabled && styles.confirmDisabled,
          ]}
        >
          <Text style={styles.confirmText}>
            {iapStatus === "purchasing" || iapStatus === "verifying"
              ? "支付处理中..."
              : `确认支付 ${selectedStoreProduct?.displayPrice ?? ""}`}
          </Text>
        </Pressable>
      </View>

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
  price: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${diamonds} 星钻，${price}`}
      onPress={onPress}
      style={[styles.packageCard, selected && styles.packageCardSelected]}
    >
      <View style={styles.packageAmount}>
        <Image
          source={diamondIcon}
          contentFit="contain"
          style={styles.packageIcon}
        />
        <Text style={styles.packageDiamonds}>{diamonds}</Text>
      </View>
      <Text style={styles.packagePrice}>{price}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F6F7" },
  headerBg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSide: {
    width: 48,
    height: 44,
    paddingLeft: 12,
    justifyContent: "center",
  },
  headerTitle: {
    color: "#0D0D0F",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  balanceSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 4,
  },
  balanceValue: {
    color: "#0D0D0F",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  balanceLabel: {
    color: "#656566",
    fontSize: 12,
    lineHeight: 18,
  },
  contentSection: {
    marginTop: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: GRID_PADDING,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  sectionHeading: { gap: 4 },
  sectionTitle: {
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  sectionDescription: {
    color: "#979799",
    fontSize: 12,
    lineHeight: 18,
  },
  shortfallValue: { color: "#FE4267" },
  packageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  packageCard: {
    width: CARD_WIDTH,
    paddingHorizontal: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 8,
    backgroundColor: "#F5F6F7",
    borderWidth: 1,
    borderColor: "transparent",
  },
  packageCardSelected: {
    borderColor: "#FF708D",
    backgroundColor: "#FFF5F7",
  },
  packageAmount: { flexDirection: "row", alignItems: "center", gap: 4 },
  packageIcon: { width: 16, height: 16 },
  packageDiamonds: {
    color: "#0A0A0A",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  packagePrice: {
    color: "#656566",
    fontSize: 12,
    lineHeight: 18,
  },
  purchaseFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  agreementRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    paddingVertical: 8,
  },
  checkboxHitArea: { width: 16, height: 18, justifyContent: "flex-start" },
  checkbox: {
    width: 16,
    height: 16,
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CACACC",
    borderRadius: 8,
  },
  checkboxSelected: { borderColor: "#FE1F4C", backgroundColor: "#FE1F4C" },
  checkboxMark: {
    color: "#FFFFFF",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
  },
  agreementCopy: {
    flex: 1,
    color: "#7F7F80",
    fontSize: 12,
    lineHeight: 18,
  },
  agreementLink: {
    color: "#0D0D0F",
    fontSize: 12,
    lineHeight: 18,
  },
  purchaseError: {
    color: "#D9363E",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  confirmButton: {
    height: 42,
    borderRadius: 8,
    backgroundColor: "#FE1F4C",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmDisabled: { opacity: 0.45 },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
});
