import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchStarBalance } from "@/features/mine/api/companion-order.api";
import {
  createAppPayOrder,
  createPayOrder,
  fetchRechargeConfig,
  type RechargeChannel,
  type RechargePlan,
} from "@/features/mine/api/recharge.api";
import { APP_LINKS } from "@/core/config/links";
import { env } from "@/core/config/env";
import { WechatPayQrModal } from "@/features/mine/components/WechatPayQrModal";
import AlipayPayment from "../../../../modules/alipay-payment";
import { openExternalLink } from "@/shared/navigation/open-external-link";
import { AppPrompt } from "@/shared/ui/AppPrompt";

const diamondIcon = require("../../../../assets/mine/figma/star-recharge-diamond-3f6fcf.png");
const headerBg = require("../../../../assets/images/star-recharge-header-bg.png");
const alipayIcon = require("../../../../assets/images/star-recharge-alipay.png");
const wechatIcon = require("../../../../assets/images/star-recharge-wechat.png");

function formatAmount(value: number): string {
  return String(value);
}

function toNumber(value: number | string | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function isWechatChannel(channel: RechargeChannel): boolean {
  const haystack = [
    channel.key,
    channel.label,
    channel.payChannel,
    channel.payWay,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes("wechat") || haystack.includes("微信");
}

function channelIconSource(channel: RechargeChannel) {
  return isWechatChannel(channel) ? wechatIcon : alipayIcon;
}

function channelStableKey(channel: RechargeChannel, index: number): string {
  return channel.key || `${channel.payChannel ?? "channel"}-${index}`;
}

function chunkPlans<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

export default function StarRechargeAndroidScreen() {
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
  const [plans, setPlans] = useState<RechargePlan[]>([]);
  const [channels, setChannels] = useState<RechargeChannel[]>([]);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [selectedChannelKey, setSelectedChannelKey] = useState<string | null>(
    null,
  );
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(true);
  const [prompt, setPrompt] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [paying, setPaying] = useState(false);
  const [wechatQrCode, setWechatQrCode] = useState<string | null>(null);

  useEffect(() => {
    // Official recommendation: register the merchant appId on the payment
    // page for anti-fraud and faster cashier launch. Optional per docs.
    if (!token || !env.alipayAppId) return;
    AlipayPayment?.registerAppAsync(env.alipayAppId).catch(() => undefined);
  }, [token]);

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

  useEffect(() => {
    if (!token) {
      setConfigLoading(false);
      setConfigError("请先登录后再充值");
      return;
    }
    let active = true;
    setConfigLoading(true);
    setConfigError(null);
    void fetchRechargeConfig(token, "ANDROID")
      .then((config) => {
        if (!active) return;
        const nextPlans = Array.isArray(config.plans) ? config.plans : [];
        const nextChannels = Array.isArray(config.channels)
          ? config.channels
          : [];
        setPlans(nextPlans);
        setChannels(nextChannels);
        setSelectedPlanIndex(0);
        setSelectedChannelKey(
          nextChannels.length > 0
            ? channelStableKey(nextChannels[0], 0)
            : null,
        );
        setConfigLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message =
          error instanceof Error && error.message
            ? error.message
            : "充值配置加载失败";
        setPlans([]);
        setChannels([]);
        setSelectedChannelKey(null);
        setConfigError(message);
        setConfigLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const selectedPlan = plans[selectedPlanIndex];
  const selectedMoney = toNumber(selectedPlan?.moneyAmount) ?? 0;
  const selectedStar = toNumber(selectedPlan?.starAmount) ?? 0;
  const selectedChannel = channels.find(
    (channel, index) => channelStableKey(channel, index) === selectedChannelKey,
  );
  const planRows = useMemo(() => chunkPlans(plans, 3), [plans]);
  const canConfirm =
    agreementAccepted &&
    !configLoading &&
    plans.length > 0 &&
    selectedPlan !== undefined;

  async function handleConfirmPay() {
    if (paying || !token || !selectedPlan) return;
    if (!selectedChannel) {
      setPrompt({ title: "提示", message: "请先选择支付方式" });
      return;
    }
    if (isWechatChannel(selectedChannel)) {
      setPaying(true);
      try {
        const order = await createPayOrder(token, {
          payChannel: selectedChannel.payChannel,
          payWay: selectedChannel.payWay,
          payTypeEnum: selectedChannel.payTypeEnum,
          moneyAmount: selectedMoney,
          starAmount: selectedStar,
        });
        if (!order.qrCode) {
          setPrompt({ title: "支付失败", message: "未获取到支付订单信息，请稍后再试。" });
          return;
        }
        setWechatQrCode(order.qrCode);
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "支付失败，请重试。";
        setPrompt({ title: "支付失败", message });
      } finally {
        setPaying(false);
      }
      return;
    }
    if (!AlipayPayment) {
      setPrompt({ title: "提示", message: "当前版本暂不支持支付宝支付，请更新 App 后重试。" });
      return;
    }
    setPaying(true);
    try {
      const order = await createAppPayOrder(token, {
        payChannel: selectedChannel.payChannel ?? "ALIPAY",
        payWay: selectedChannel.payWay ?? "ALIPAY_APP",
        moneyAmount: selectedMoney,
        starAmount: selectedStar,
      });
      if (!order.orderStr) {
        setPrompt({ title: "支付失败", message: "未获取到支付订单信息，请稍后再试。" });
        return;
      }
      const result = await AlipayPayment.payAsync(
        order.orderStr,
        // 沙箱支付，暂无法使用
        false,
      );
      if (result.code === "SUCCESS") {
        setPrompt({ title: "支付成功", message: "星钻已到账。" });
        fetchStarBalance(token)
          .then((nextBalance) => setBalance(nextBalance))
          .catch(() => undefined);
      } else if (result.code === "DEALING") {
        setPrompt({ title: "支付处理中", message: result.message ?? "支付处理中，请稍后在订单中查看结果。" });
      } else if (result.code === "CANCELLED") {
        setPrompt({ title: "支付取消", message: "已取消本次支付。" });
      } else {
        setPrompt({ title: "支付失败", message: result.message ?? "支付失败，请重试。" });
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "支付失败，请重试。";
      setPrompt({ title: "支付失败", message });
    } finally {
      setPaying(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Image
        source={headerBg}
        contentFit="cover"
        style={styles.headerBg}
        pointerEvents="none"
      />

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

      <View style={styles.balanceSection}>
        <Text style={styles.balanceValue}>
          {balance === null ? "--" : formatAmount(balance)}
        </Text>
        <Text style={styles.balanceLabel}>我的星钻余额</Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
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

          {configLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#FE1F4C" />
            </View>
          ) : configError ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>{configError}</Text>
            </View>
          ) : plans.length === 0 ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>暂无可用充值档位</Text>
            </View>
          ) : (
            <View style={styles.packageGrid}>
              {planRows.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.packageRow}>
                  {row.map((item, colIndex) => {
                    const index = rowIndex * 3 + colIndex;
                    const diamonds = toNumber(item.starAmount) ?? 0;
                    const price = toNumber(item.moneyAmount) ?? 0;
                    return (
                      <RechargeOption
                        key={`plan-${index}`}
                        diamonds={diamonds}
                        price={price}
                        selected={selectedPlanIndex === index}
                        onPress={() => setSelectedPlanIndex(index)}
                      />
                    );
                  })}
                  {row.length < 3
                    ? Array.from({ length: 3 - row.length }).map((_, filler) => (
                        <View
                          key={`filler-${rowIndex}-${filler}`}
                          style={styles.packageFiller}
                        />
                      ))
                    : null}
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>请选择支付方式</Text>
          </View>
          {configLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#FE1F4C" />
            </View>
          ) : channels.length === 0 ? (
            <View style={[styles.stateBox, styles.channelEmpty]}>
              <Text style={styles.stateText}>
                {configError ?? "暂无可用支付方式"}
              </Text>
            </View>
          ) : (
            channels.map((channel, index) => {
              const key = channelStableKey(channel, index);
              const selected = selectedChannelKey === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={channel.label || key}
                  onPress={() => setSelectedChannelKey(key)}
                  style={[
                    styles.channelRow,
                    index < channels.length - 1 && styles.channelRowBorder,
                  ]}
                >
                  <View style={styles.channelMain}>
                    <Image
                      source={channelIconSource(channel)}
                      contentFit="contain"
                      style={styles.channelIcon}
                    />
                    <Text style={styles.channelLabel}>
                      {channel.label || key}
                    </Text>
                  </View>
                  <RadioMark selected={selected} />
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}
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
            <RadioMark selected={agreementAccepted} size={16} />
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

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canConfirm || paying }}
          disabled={!canConfirm || paying}
          onPress={() => {
            void handleConfirmPay();
          }}
          style={[
            styles.confirmButton,
            !canConfirm && styles.confirmDisabled,
            paying && styles.confirmDisabled,
          ]}
        >
          <Text style={styles.confirmText}>
            {paying ? "支付中…" : `确认支付 ¥${formatAmount(selectedMoney)}`}
          </Text>
        </Pressable>
      </View>

      <WechatPayQrModal
        visible={wechatQrCode !== null}
        qrCode={wechatQrCode ?? ""}
        moneyAmount={selectedMoney}
        starAmount={selectedStar}
        onClose={() => {
          setWechatQrCode(null);
          if (!token) return;
          void fetchStarBalance(token)
            .then((nextBalance) => setBalance(nextBalance))
            .catch(() => undefined);
        }}
      />

      <AppPrompt
        visible={prompt !== null}
        title={prompt?.title ?? "提示"}
        message={prompt?.message ?? ""}
        onConfirm={() => setPrompt(null)}
      />
    </View>
  );
}

function RadioMark({
  selected,
  size = 20,
}: {
  selected: boolean;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.radio,
        { width: size, height: size, borderRadius: size / 2 },
        selected && styles.radioSelected,
      ]}
    >
      {selected ? <Text style={styles.radioMark}>✓</Text> : null}
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
        <Text style={styles.packageDiamonds}>{formatAmount(diamonds)}</Text>
      </View>
      <Text style={styles.packagePrice}>¥{formatAmount(price)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F6F7" },
  headerBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 276,
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
  backIcon: { width: 24, height: 24 },
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
    alignItems: "center",
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
  body: { flex: 1 },
  bodyContent: {
    gap: 8,
    paddingBottom: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },
  sectionHeading: {
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
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
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  packageRow: { flexDirection: "row", gap: 8 },
  packageCard: {
    flex: 1,
    minHeight: 68,
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
  packageFiller: { flex: 1 },
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
    textAlign: "center",
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  channelRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E9E9EB",
  },
  channelMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  channelIcon: { width: 24, height: 24 },
  channelLabel: {
    color: "#0D0D0F",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#CACACC",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: "#FE1F4C",
    backgroundColor: "#FE1F4C",
  },
  radioMark: {
    color: "#FFFFFF",
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "700",
  },
  stateBox: {
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  channelEmpty: { paddingTop: 0 },
  stateText: {
    color: "#979799",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  footer: {
    backgroundColor: "#FFFFFF",
    paddingTop: 8,
  },
  agreementRow: {
    minHeight: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  checkboxHitArea: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
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
  confirmButton: {
    marginHorizontal: 16,
    marginTop: 8,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#FE1F4C",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  confirmDisabled: { opacity: 0.45 },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
});
