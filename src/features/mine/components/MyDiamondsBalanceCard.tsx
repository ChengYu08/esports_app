import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const walletCardBg = require("../../../../assets/images/my-diamonds-wallect-card.png");
const diamondIcon = require("../../../../assets/images/my-diamonds-coin.png");
const payIcon = require("../../../../assets/svgs/my-diamonds-pay.svg");
const arrowRightIcon = require("../../../../assets/svgs/my-diamonds-arrow-right.svg");

type MyDiamondsBalanceCardProps = {
  balance: number | null;
  onRecharge: () => void;
};

function formatBalance(value: number | null): string {
  if (value === null) return "--";
  return value.toLocaleString("en-US");
}

export const MyDiamondsBalanceCard = memo(function MyDiamondsBalanceCard({
  balance,
  onRecharge,
}: MyDiamondsBalanceCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.body}>
        <Image
          source={walletCardBg}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
        />
        <Image source={diamondIcon} style={styles.diamond} contentFit="contain" />
        <Text style={styles.label}>钻石收益</Text>
        <Text style={styles.balance}>{formatBalance(balance)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="去充值"
        onPress={onRecharge}
      >
        <LinearGradient
          colors={["#FFF5F7", "#FFEBEF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.action}
        >
          <View style={styles.actionLeft}>
            <Image source={payIcon} style={styles.payIcon} contentFit="contain" />
            <Text style={styles.actionText}>去充值</Text>
          </View>
          <Image
            source={arrowRightIcon}
            style={styles.arrow}
            contentFit="contain"
          />
        </LinearGradient>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: "hidden",
  },
  body: {
    // 与 my-diamonds-wallect-card.png（1053×414）同比例，避免背景被裁切
    aspectRatio: 1053 / 414,
    width: "100%",
    paddingTop: 24,
    paddingBottom: 20,
    paddingLeft: 24,
    paddingRight: 88,
    position: "relative",
    overflow: "hidden",
  },
  diamond: {
    position: "absolute",
    right: 20,
    top: 48,
    width: 70,
    height: 70,
  },
  label: {
    color: "#0D0D0F",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  balance: {
    marginTop: 8,
    color: "#6B0F22",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 12,
  },
  actionLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  payIcon: { width: 16, height: 16 },
  actionText: {
    flex: 1,
    color: "#FE4267",
    fontSize: 12,
    lineHeight: 18,
  },
  arrow: { width: 16, height: 16 },
});
