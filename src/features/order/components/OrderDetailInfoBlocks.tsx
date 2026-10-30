import { Pressable, StyleSheet, Text, View } from "react-native";

import { CachedImage } from "@/shared/ui/CachedImage";
import type { OrderItemModel } from "@/features/order/order.types";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { OrderDetailInfoRow } from "@/features/order/components/OrderDetailInfoRow";
import {
  formatOrderTime,
  formatServiceTime,
} from "@/features/order/order-detail-format";

/** 订单信息区：服务信息块（卖家 + 游戏服务单价）+ 订单信息块（编号 + 时间） */
export function OrderDetailInfoBlocks({
  order,
  scope,
  orderNumber,
  onCopy,
  onChat,
}: {
  order: OrderItemModel;
  scope: "accept" | "place";
  orderNumber: string;
  onCopy: () => void;
  onChat: () => void;
}) {
  return (
    <>
      <View
        style={[
          styles.infoBlock,
          scope === "accept" && styles.acceptInfoBlock,
        ]}
      >
        <View style={styles.sellerRow}>
          <CachedImage
            contentFit="cover"
            source={order.sellerAvatar}
            style={styles.avatar}
          />
          <View style={styles.sellerCopy}>
            <Text
              style={[
                styles.sellerName,
                scope === "accept" && styles.acceptSellerName,
              ]}
            >
              {order.sellerName}
            </Text>
            {scope !== "accept" && (
              <Text style={styles.muted}>盼之电竞自营俱乐部</Text>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onChat}
            style={[
              styles.chatButton,
              scope === "accept" && styles.acceptChatButton,
            ]}
          >
            <Text
              style={[
                styles.chatText,
                scope === "accept" && styles.acceptChatText,
              ]}
            >
              聊一聊
            </Text>
          </Pressable>
        </View>
        <View style={styles.divider} />
        <OrderDetailInfoRow
          acceptStyle={scope === "accept"}
          label="游戏"
          value={order.gameName}
        />
        <OrderDetailInfoRow
          acceptStyle={scope === "accept"}
          label="服务"
          value={order.serviceName.replace("服务", "")}
        />
        <OrderDetailInfoRow
          acceptStyle={scope === "accept"}
          label="备注"
          value={order.remark || "-"}
          multiline={scope === "accept"}
        />
        <OrderDetailInfoRow
          acceptStyle={scope === "accept"}
          label="单价"
          value={`${order.unitPrice}星钻/${order.billingUnitName ?? "小时"}`}
        />
        <OrderDetailInfoRow
          acceptStyle={scope === "accept"}
          label="个数"
          value={`x ${order.quantity}`}
        />
        <OrderDetailInfoRow
          acceptStyle={scope === "accept"}
          label={scope === "accept" ? "合计" : "实付款"}
          value={`${order.totalPrice}星钻`}
        />
      </View>
      <View
        style={[
          styles.infoBlock,
          scope === "accept" && styles.acceptDetailsBlock,
        ]}
      >
        <OrderDetailInfoRow
          acceptStyle={scope === "accept"}
          label="订单编号"
          value={orderNumber}
          copy
          onCopy={onCopy}
        />
        <OrderDetailInfoRow
          acceptStyle={scope === "accept"}
          label="创建时间"
          value={formatOrderTime(order.createTime)}
        />
        {scope === "accept" ? (
          <OrderDetailInfoRow
            acceptStyle
            label="派单时间"
            value={formatOrderTime(order.dispatchTime ?? order.acceptedTime)}
          />
        ) : (
          <>
            <OrderDetailInfoRow
              label="支付时间"
              value={formatOrderTime(order.paidTime)}
            />
            <OrderDetailInfoRow
              label="接单时间"
              value={formatOrderTime(order.acceptedTime)}
            />
            <OrderDetailInfoRow
              label="服务时间"
              value={formatServiceTime(
                order.serviceStartTime,
                order.serviceEndTime,
              )}
            />
            <OrderDetailInfoRow
              label="完成时间"
              value={formatOrderTime(order.completedTime)}
            />
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  infoBlock: {
    gap: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 14,
    borderTopColor: "#F7F7F7",
  },
  acceptInfoBlock: { borderTopWidth: 14 },
  acceptDetailsBlock: { borderTopWidth: 8, paddingVertical: 8 },
  sellerRow: { flexDirection: "row", alignItems: "center", minHeight: 58 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  sellerCopy: { flex: 1, gap: 4 },
  sellerName: {
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 17,
    fontWeight: "600",
  },
  acceptSellerName: { fontSize: 14 },
  muted: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 13 },
  chatButton: {
    backgroundColor: "#FF2850",
    borderRadius: 20,
    paddingHorizontal: 18,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  chatText: {
    color: "#FFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "600",
  },
  acceptChatButton: { height: 26, borderRadius: 13, paddingHorizontal: 12 },
  acceptChatText: { fontSize: 12 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EEE",
    marginVertical: 8,
  },
});
