import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { OrderDetailInfoRow } from "@/features/order/components/OrderDetailInfoRow";
import {
    computeOrderPayableStars,
    formatOrderFreeSummary,
    formatStar,
} from "@/features/order/free-amount";
import {
    formatOrderTime,
    formatServiceTime,
} from "@/features/order/order-detail-format";
import type {
    MultiCompanionCandidateModel,
    OrderItemModel,
} from "@/features/order/order.types";
import { SYSTEM_FONT } from "@/shared/theme/typography";
import { CachedImage } from "@/shared/ui/CachedImage";

/** 订单信息区：服务信息块（卖家 + 游戏服务单价）+ 订单信息块（编号 + 时间） */
export function OrderDetailInfoBlocks({
  order,
  scope,
  clubName,
  clubLogoUrl,
  companionClubs,
  orderNumber,
  onCopy,
  onChat,
}: {
  order: OrderItemModel;
  scope: "accept" | "place";
  /** 大神所属俱乐部名（详情接口只回 id，由外部解析后传入） */
  clubName?: string;
  clubLogoUrl?: string;
  companionClubs: Record<
    string,
    { clubId: number; clubName: string; logoUrl?: string } | undefined
  >;
  orderNumber: string;
  onCopy: () => void;
  onChat: (companion?: MultiCompanionCandidateModel) => void;
}) {
  const freeSummary = formatOrderFreeSummary(order);
  const amountLabel = scope === "accept" ? "合计" : "实付款";
  const multiple = scope === "place" && (order.companions?.length ?? 0) > 0;
  return (
    <>
      <View
        style={[styles.infoBlock, scope === "accept" && styles.acceptInfoBlock]}
      >
        <View
          style={[
            styles.sellerRow,
            scope === "accept" && styles.acceptSellerRow,
            multiple && styles.multiSellerRow,
          ]}
        >
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
            {clubName ? (
              <ClubLabel
                key={clubLogoUrl || "no-logo"}
                name={clubName}
                logoUrl={clubLogoUrl}
              />
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => onChat()}
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
        {scope === "place" &&
          order.companions?.map((companion, index) => (
            <View
              key={`${companion.userId}-${index}`}
              style={[styles.sellerRow, styles.multiSellerRow]}
            >
              <CachedImage
                contentFit="cover"
                source={
                  companion.headImage
                    ? { uri: companion.headImage }
                    : require("../../../../assets/images/avatar_default.webp")
                }
                style={styles.avatar}
              />
              <View style={styles.sellerCopy}>
                <Text numberOfLines={1} style={styles.sellerName}>
                  {companion.nickname || "大神"}
                </Text>
                {(companion.clubName ||
                  companionClubs[companion.userId]?.clubName) && (
                  <ClubLabel
                    key={companionClubs[companion.userId]?.logoUrl || "no-logo"}
                    name={
                      companion.clubName ||
                      companionClubs[companion.userId]!.clubName
                    }
                    logoUrl={companionClubs[companion.userId]?.logoUrl}
                  />
                )}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`联系${companion.nickname || "大神"}`}
                onPress={() =>
                  onChat({
                    ...companion,
                    clubId:
                      companion.clubId ??
                      companionClubs[companion.userId]?.clubId,
                  })
                }
                style={styles.chatButton}
              >
                <Text style={styles.chatText}>聊一聊</Text>
              </Pressable>
            </View>
          ))}
        <View
          style={[styles.divider, scope === "accept" && styles.acceptDivider]}
        />
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
            value={`${order.unitPrice}钻石/${order.billingUnitName ?? "小时"}`}
          />
          <OrderDetailInfoRow
            acceptStyle={scope === "accept"}
            label="个数"
            value={`x ${order.quantity}`}
          />
          <OrderDetailInfoRow
            acceptStyle={scope === "accept"}
            label={freeSummary ? `原${amountLabel}` : amountLabel}
            value={`${order.totalPrice}钻石`}
          />
          {(order.discountAmount ?? 0) > 0 ? (
            <OrderDetailInfoRow
              acceptStyle={scope === "accept"}
              label="优惠"
              value={`已优惠 ${formatStar(order.discountAmount ?? 0)} 星钻`}
            />
          ) : null}
          {freeSummary ? (
            <>
              <OrderDetailInfoRow
                acceptStyle={scope === "accept"}
                label="免单"
                value={freeSummary}
              />
              <OrderDetailInfoRow
                acceptStyle={scope === "accept"}
                label={`${amountLabel}(免单后)`}
                amount
                value={`${formatStar(computeOrderPayableStars(order))}钻石`}
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
            // 派单时间：单子排到大神侧的时间；普通单即支付完成进入接单池的时间
            label="派单时间"
            value={formatOrderTime(order.dispatchTime ?? order.paidTime)}
          />
        ) : (
          <OrderDetailInfoRow
            label="支付时间"
            value={formatOrderTime(order.paidTime)}
          />
        )}
        <OrderDetailInfoRow
          acceptStyle={scope === "accept"}
          label="接单时间"
          value={formatOrderTime(order.acceptedTime)}
        />
        <OrderDetailInfoRow
          acceptStyle={scope === "accept"}
          label="服务时间"
          value={formatServiceTime(
            order.serviceStartTime,
            order.serviceEndTime,
          )}
        />
        <OrderDetailInfoRow
          acceptStyle={scope === "accept"}
          label="完成时间"
          value={formatOrderTime(order.completedTime)}
        />
      </View>
    </>
  );
}

function ClubLabel({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.clubLine}>
      {logoUrl && !failed && (
        <CachedImage
          source={{ uri: logoUrl }}
          style={styles.clubLogo}
          contentFit="cover"
          onError={() => setFailed(true)}
        />
      )}
      <Text numberOfLines={1} style={styles.muted}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  infoBlock: {
    gap: 0,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 8,
    borderTopColor: "#F7F7F7",
    backgroundColor: "#FFF",
  },
  acceptInfoBlock: {
    borderTopWidth: 8,
    paddingVertical: 0,
    backgroundColor: "#FFF",
  },
  acceptDetailsBlock: {
    borderTopWidth: 8,
    paddingVertical: 6,
    backgroundColor: "#FFF",
  },
  acceptRows: { paddingVertical: 6 },
  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingVertical: 12,
  },
  multiSellerRow: {
    backgroundColor: "#F7F7F7",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  clubLine: { flexDirection: "row", alignItems: "center", gap: 2 },
  clubLogo: { width: 12, height: 12, borderRadius: 2 },
  acceptSellerRow: { minHeight: 56, paddingVertical: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 8 },
  acceptAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 8 },
  sellerCopy: { flex: 1, minWidth: 0, gap: 4 },
  sellerName: {
    color: "#111",
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
  acceptSellerName: {
    color: "#0A0A0A",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
  muted: {
    flexShrink: 1,
    color: "#999",
    fontFamily: SYSTEM_FONT,
    fontSize: 11,
    lineHeight: 14,
  },
  chatButton: {
    backgroundColor: "#FE1F4C",
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  chatText: {
    color: "#FFF",
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  acceptChatButton: {
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 12,
    backgroundColor: "#FE1F4C",
  },
  acceptChatText: { fontSize: 12, fontWeight: "500", lineHeight: 18 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EEE",
    marginVertical: 0,
  },
  acceptDivider: { backgroundColor: "#EBEBEB", marginVertical: 0 },
});
