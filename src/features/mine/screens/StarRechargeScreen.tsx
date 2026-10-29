import { useAuthStore } from "@esports/auth";
import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useStarIap } from "@/features/iap/use-star-iap";
import { fetchStarBalance } from "@/features/mine/api/companion-order.api";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { Skeleton } from "@/shared/ui/Skeleton";

const diamondIcon = require("../../../../assets/mine/figma/star-recharge-diamond-3f6fcf.png");

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

  // 后端档位已就位，但苹果价格还没全部拉回来 => 认为页面仍在加载。
  // 任意一个档位缺价格都视为未就绪，避免骨架屏提前消失后价格还是 "--"。
  const pricesReady =
    packages.length > 0 &&
    packages.every((item) =>
      products.some((product) => product.id === item.productId),
    );
  const pageLoading = !pricesReady;

  // 选中项为派生值：用户未手动选择或所选档位已下架时，回退到第二个（或第一个）档位。
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
          <ChevronLeft24Regular
            color="#0D0D0F"
            width={24}
            height={24}
            style={styles.backIcon}
          />
        </Pressable>
        <Text style={styles.headerTitle}>星钻充值</Text>
        <View style={styles.headerSide} />
      </View>

      {pageLoading ? (
        <RechargePageSkeleton bottomInset={insets.bottom} />
      ) : (
        <>
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
                <View style={styles.packageRow}>
                  {packages.map((item) => {
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

              {iapErrorMessage ? (
                <Text style={styles.purchaseError}>{iapErrorMessage}</Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: purchaseDisabled }}
                disabled={purchaseDisabled}
                onPress={handleConfirmPurchase}
                style={styles.confirmButton}
              >
                <LinearGradient
                  colors={["#FF1F2E", "#FF1F69"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.confirmGradient,
                    purchaseDisabled && styles.confirmDisabled,
                  ]}
                >
                  <Text style={styles.confirmText}>
                    {iapStatus === "purchasing" || iapStatus === "verifying"
                      ? "支付处理中..."
                      : `确认支付 ${selectedStoreProduct?.displayPrice ?? ""}`}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        </>
      )}

      <AppPrompt
        visible={prompt !== null}
        title={prompt?.title ?? "提示"}
        message={prompt?.message ?? ""}
        onConfirm={() => setPrompt(null)}
      />
    </View>
  );
}

function RechargePageSkeleton({ bottomInset }: { bottomInset: number }) {
  return (
    <View
      accessible
      accessibilityLabel="星钻充值加载中"
      accessibilityState={{ busy: true }}
      style={[styles.skeletonPage, { paddingBottom: bottomInset + 16 }]}
    >
      <View style={styles.skeletonBalance}>
        <Skeleton width={84} height={12} radius={6} />
        <Skeleton width={140} height={32} radius={8} />
      </View>

      <View style={styles.skeletonSection}>
        <Skeleton width={112} height={14} radius={6} />
        <Skeleton width={200} height={12} radius={6} />
      </View>

      <View style={styles.packageRow}>
        {[0, 1, 2].map((index) => (
          <Skeleton
            key={index}
            height={68}
            radius={8}
            style={styles.packageCardSkeleton}
          />
        ))}
      </View>

      <View style={styles.skeletonFooter}>
        <Skeleton width={180} height={14} radius={6} />
        <Skeleton height={42} radius={21} style={styles.skeletonConfirm} />
      </View>
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
        <Text style={[styles.packageDiamonds, selected && styles.selectedText]}>
          {diamonds}
        </Text>
      </View>
      <Text style={[styles.packagePrice, selected && styles.selectedText]}>
        {price}
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
    fontSize: 12,
    lineHeight: 18,
  },
  balanceValue: {
    color: "#0A0A0A",
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
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  sectionDescription: {
    color: "#808080",
    fontSize: 12,
    lineHeight: 18,
  },
  shortfallValue: { color: "#3DA5FF" },
  packageGrid: { gap: 12 },
  packageRow: { flexDirection: "row", gap: 12 },
  packageCardSkeleton: { flex: 1 },
  skeletonPage: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  skeletonBalance: {
    paddingVertical: 16,
    alignItems: "center",
    gap: 10,
  },
  skeletonSection: { gap: 8 },
  skeletonFooter: { marginTop: "auto", gap: 12 },
  skeletonConfirm: { width: "100%" },
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
  purchaseError: {
    color: "#D9363E",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
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
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "700",
  },
  agreementCopy: {
    color: "#ABABAD",
    fontSize: 11,
    lineHeight: 18,
  },
  agreementLink: {
    color: "#3DA5FF",
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
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
});
