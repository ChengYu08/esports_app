import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import type { OrderItemModel, OrderScope } from "@/features/order/order.types";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const orderStepCheck = require("../../../../assets/order/order-step-check.svg");
const orderStepActive = require("../../../../assets/order/order-step-active.svg");
const orderStepPending = require("../../../../assets/order/order-step-pending.svg");

/** 订单进度步骤条：支付 → 陪玩确认/抢单 → 陪玩服务 → 服务完成 */
export function OrderProgressSteps({
  status,
  scope,
}: {
  status: OrderItemModel["status"];
  scope: OrderScope;
}) {
  const labels = [
    "支付订单",
    scope === "accept" ? "陪玩抢单" : "陪玩确认",
    "陪玩服务",
    "服务完成",
  ];
  const activeStep =
    status === "pendingPayment"
      ? 0
      : status === "paid"
        ? 1
        : status === "waitingService" || status === "inService"
          ? 2
          : 4;
  return (
    <View style={[styles.flow, scope === "accept" && styles.acceptFlow]}>
      <View style={styles.flowLine} />
      {labels.map((label, index) => {
        const done = index < activeStep;
        const active = index === activeStep;
        return (
          <View style={styles.flowStep} key={label}>
            <View
              style={[
                styles.flowMarker,
                scope === "accept" && styles.acceptFlowMarker,
                done && styles.flowMarkerDone,
                active && styles.flowMarkerActive,
              ]}
            >
              {done ? (
                scope === "accept" ? (
                  <Image
                    source={orderStepCheck}
                    style={styles.acceptFlowIcon}
                  />
                ) : (
                  <Text style={styles.flowCheck}>✓</Text>
                )
              ) : active ? (
                scope === "accept" ? (
                  <Image
                    source={orderStepActive}
                    style={styles.acceptFlowIcon}
                  />
                ) : (
                  <View style={styles.flowActiveDot} />
                )
              ) : scope === "accept" ? (
                <View style={styles.acceptPendingMarker}>
                  <Image
                    source={orderStepPending}
                    style={styles.acceptPendingIcon}
                  />
                  <Text style={styles.acceptFlowNumber}>{index + 1}</Text>
                </View>
              ) : (
                <Text style={styles.flowNumber}>{index + 1}</Text>
              )}
            </View>
            <Text
              style={[
                styles.flowLabel,
                scope === "accept" && styles.acceptFlowLabel,
                index > activeStep && styles.flowLabelMuted,
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flow: {
    height: 74,
    flexDirection: "row",
    position: "relative",
    alignItems: "flex-start",
  },
  acceptFlow: { height: 74 },
  acceptFlowIcon: { width: 24, height: 24 },
  acceptPendingMarker: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptPendingIcon: { position: "absolute", width: 20, height: 20 },
  acceptFlowNumber: {
    color: "#FFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "500",
  },
  flowLine: {
    position: "absolute",
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E4E4E4",
    left: "12.5%",
    right: "12.5%",
    top: 11,
  },
  flowStep: { flex: 1, alignItems: "center", zIndex: 1 },
  flowMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#D1D1D1",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptFlowMarker: { width: 24, height: 24, borderRadius: 12 },
  flowMarkerDone: { backgroundColor: "#E4FBF1" },
  flowMarkerActive: { backgroundColor: "#FFE9EE" },
  flowCheck: {
    color: "#13B979",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  flowActiveDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#FF3150",
  },
  flowNumber: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  flowLabel: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    marginTop: 9,
  },
  acceptFlowLabel: { fontSize: 12, marginTop: 7 },
  flowLabelMuted: { color: "#999" },
});
