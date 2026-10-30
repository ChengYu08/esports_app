import { Pressable, StyleSheet, Text, View } from "react-native";

import { CachedImage } from "@/shared/ui/CachedImage";
import type { OrderItemModel } from "@/features/order/order.types";
import { SYSTEM_FONT } from "@/shared/theme/typography";
import { computeOrderPayableStars, formatOrderFreeSummary, formatStar } from "@/features/order/free-amount";
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
  const freeSummary = formatOrderFreeSummary(order);
  const amountLabel = scope === "accept" ? "合计" : "实付款";
  return (
    <>
      <View
        style={[
          styles.infoBlock,
          scope === "accept" && styles.acceptInfoBlock,
        ]}
      >
        <View style={[styles.sellerRow, scope === "accept" && styles.acceptSellerRow]}>
          <CachedImage
            contentFit="cover"
            source={order.sellerAvatar}
            style={[styles.avatar, scope === "accept" && styles.acceptAvatar]}
          />
          <View style={styles.sellerCopy}>
            <Text
              numberOfLines={1}
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
        <View style={[styles.divider, scope === "accept" && styles.acceptDivider]} />
        <View style={scope === "accept" && styles.acceptRows}>
          <OrderDetailInfoRow
            acceptStyle={scope === "accept"}
            label="游戏"
            value={order.gameName}
          />
          <OrderDetailInfoRow
            acceptStyle={scope === "accept"}
            label="服务"
            value={order.serviceName}
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
            label={freeSummary ? `原${amountLabel}` : amountLabel}
            value={`${order.totalPrice}星钻`}
          />
          {freeSummary ? (
            <>
              <OrderDetailInfoRow acceptStyle={scope === "accept"} label="免单" value={freeSummary} />
              <OrderDetailInfoRow
                acceptStyle={scope === "accept"}
                label={`${amountLabel}(免单后)`}
                amount
                value={`${formatStar(computeOrderPayableStars(order))}星钻`}
              />
            </>
          ) : null}
        </View>
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
  acceptInfoBlock: { borderTopWidth: 8, paddingVertical: 0, backgroundColor: "#FFF" },
  acceptDetailsBlock: { borderTopWidth: 8, paddingVertical: 6, backgroundColor: "#FFF" },
  acceptRows: { paddingVertical: 6 },
  sellerRow: { flexDirection: "row", alignItems: "center", minHeight: 58 },
  acceptSellerRow: { minHeight: 56, paddingVertical: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  acceptAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  sellerCopy: { flex: 1, minWidth: 0, gap: 4 },
  sellerName: {
    color: "#111",
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    fontWeight: "600",
  },
  acceptSellerName: { color: "#0A0A0A", fontSize: 14, fontWeight: "500", lineHeight: 22 },
  muted: { color: "#999", fontFamily: SYSTEM_FONT, fontSize: 13 },
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
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: "600",
  },
  acceptChatButton: { height: 26, borderRadius: 13, paddingHorizontal: 12, backgroundColor: "#FE1F4C" },
  acceptChatText: { fontSize: 12, fontWeight: "500", lineHeight: 18 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EEE",
    marginVertical: 8,
  },
  acceptDivider: { backgroundColor: "#EBEBEB", marginVertical: 0 },
});
