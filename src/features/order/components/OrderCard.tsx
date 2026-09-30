import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import type {
  OrderAction,
  OrderActionKey,
  OrderItemModel,
  OrderStatus,
} from "../order.types";

const PRIMARY_GRADIENT = ["#FF1F2E", "#FF1F69"] as const;

const STATUS_COLORS: Record<OrderStatus, string> = {
  pendingPayment: "#FF943D",
  paid: "#14A357",
  waitingService: "#FF943D",
  inService: "#FF943D",
  completed: "#808080",
  cancelled: "#808080",
  refunded: "#808080",
};

type OrderCardProps = {
  item: OrderItemModel;
  onAction: (item: OrderItemModel, action: OrderActionKey) => void;
  onPress?: (item: OrderItemModel) => void;
};

export const OrderCard = memo(function OrderCard({
  item,
  onAction,
  onPress,
}: OrderCardProps) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole={onPress ? "button" : undefined}
        onPress={() => onPress?.(item)}
        style={({ pressed }) => pressed && styles.cardPressed}
      >
      <View style={styles.sellerRow}>
        <View style={styles.seller}>
          <Image
            contentFit="cover"
            source={item.sellerAvatar}
            style={styles.avatar}
          />
          <Text numberOfLines={1} style={styles.sellerName}>
            {item.sellerName}
          </Text>
        </View>
        <Text style={[styles.status, { color: STATUS_COLORS[item.status] }]}>
          {item.statusLabel}
        </Text>
      </View>

      <View style={styles.orderBody}>
        <View style={styles.productRow}>
          <View style={styles.productCopy}>
            <Text numberOfLines={1} style={styles.serviceName}>
              {item.serviceName}
            </Text>
            <Text numberOfLines={1} style={styles.gameName}>
              {item.gameName}
            </Text>
          </View>
          <View style={styles.priceBlock}>
            <Text style={styles.unitPrice}>{item.unitPrice}</Text>
            <Text style={styles.quantity}>x {item.quantity}</Text>
          </View>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>共</Text>
          <Text style={styles.totalPrice}>{item.totalPrice}</Text>
        </View>
      </View>
      </Pressable>

      {item.actions.length > 0 && <View style={styles.actions}>
        {item.actions.map((action) => (
          <ActionButton action={action} key={action.key} onPress={() => onAction(item, action.key)} />
        ))}
      </View>}
    </View>
  );
});

function ActionButton({
  action,
  onPress,
}: {
  action: OrderAction;
  onPress: () => void;
}) {
  if (action.variant === "primary") {
    return (
      <Pressable
        accessibilityLabel={action.label}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => pressed && styles.buttonPressed}
      >
        <LinearGradient
          colors={PRIMARY_GRADIENT}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>{action.label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityLabel={action.label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{action.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    gap: 12,
  },
  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  seller: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: { width: 24, height: 24, borderRadius: 12 },
  sellerName: {
    flex: 1,
    fontFamily: DOUYIN_SANS,
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  status: {
    marginLeft: 12,
    fontFamily: DOUYIN_SANS,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
  },
  orderBody: { gap: 4 },
  productRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  productCopy: { flex: 1, gap: 4 },
  serviceName: {
    fontFamily: DOUYIN_SANS,
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
  },
  gameName: {
    fontFamily: DOUYIN_SANS,
    color: "#999999",
    fontSize: 12,
    lineHeight: 18,
  },
  priceBlock: { width: 80, alignItems: "flex-end", gap: 4 },
  unitPrice: {
    fontFamily: DOUYIN_SANS,
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  quantity: {
    fontFamily: DOUYIN_SANS,
    color: "#999999",
    fontSize: 12,
    lineHeight: 18,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    gap: 4,
  },
  totalLabel: {
    fontFamily: DOUYIN_SANS,
    color: "#0A0A0A",
    fontSize: 12,
    lineHeight: 18,
  },
  totalPrice: {
    fontFamily: DOUYIN_SANS,
    color: "#FE1F4C",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  actions: {
    minHeight: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  secondaryButton: {
    minHeight: 26,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#CCCCCC",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontFamily: DOUYIN_SANS,
    color: "#0A0A0A",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  primaryButton: {
    minHeight: 26,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontFamily: DOUYIN_SANS,
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  buttonPressed: { opacity: 0.65 },
  cardPressed: { opacity: 0.72 },
});
