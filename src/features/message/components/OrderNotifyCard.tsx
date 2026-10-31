import { ChevronRight16Regular } from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import type { OrderNotifyCardMessage } from "../chat-message";

const orderAssistantCoin = require("../../../../assets/message/order-assistant-coin-3f6fcf.webp");

type OrderNotifyCardProps = {
  item: OrderNotifyCardMessage;
  onOpenOrder?: (orderId: string) => void;
};

function formatOrderNotifyDate(value?: string) {
  return value?.replace("T", " ").trim().slice(0, 10) || undefined;
}

export const OrderNotifyCard = memo(function OrderNotifyCard({
  item,
  onOpenOrder,
}: OrderNotifyCardProps) {
  const canOpenOrder = Boolean(item.orderId && onOpenOrder);
  const metadata = [
    item.gameName,
    item.numDesc,
    formatOrderNotifyDate(item.createTime),
  ].filter((value): value is string => Boolean(value));

  if (metadata.length === 0 && item.orderNo) metadata.push(item.orderNo);

  return (
    <Pressable
      accessibilityLabel={canOpenOrder ? "查看订单详情" : undefined}
      accessibilityRole={canOpenOrder ? "button" : undefined}
      disabled={!canOpenOrder}
      onPress={() => {
        if (item.orderId) onOpenOrder?.(item.orderId);
      }}
      style={({ pressed }) => [styles.card, pressed && canOpenOrder && styles.cardPressed]}
    >
      <Text numberOfLines={2} style={styles.title}>
        {item.title}
      </Text>
      <View style={styles.details}>
        <View style={styles.copy}>
          {item.serviceDesc ? (
            <Text style={styles.service}>
              {item.serviceDesc}
            </Text>
          ) : null}
          {metadata.length > 0 ? (
            <Text style={styles.metadataText}>{metadata.join(" | ")}</Text>
          ) : null}
        </View>
        <View style={styles.price}>
          {item.totalPriceDesc ? (
            <>
              <Text style={styles.amount}>
                {item.totalPriceDesc}
              </Text>
              <Image source={orderAssistantCoin} style={styles.coin} />
            </>
          ) : null}
          {canOpenOrder ? <ChevronRight16Regular color="#0A0A0A" width={16} height={16} style={styles.arrow} /> : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    gap: 12,
  },
  cardPressed: { opacity: 0.78 },
  title: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
  details: {
    minHeight: 42,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    gap: 8,
  },
  copy: { minWidth: 0, gap: 4 },
  service: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  metadataText: {
    color: "#999999",
    fontFamily: DOUYIN_SANS,
    fontSize: 10,
    lineHeight: 14,
  },
  price: {
    alignSelf: "flex-end",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  amount: {
    flexShrink: 1,
    color: "#FE1F4C",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  coin: { width: 14, height: 12, flexShrink: 0 },
  arrow: { width: 16, height: 16, flexShrink: 0 },
});
