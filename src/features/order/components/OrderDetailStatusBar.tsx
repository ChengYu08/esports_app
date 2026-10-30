import { StyleSheet, Text, View } from "react-native";

import { formatCountdown } from "@/features/order/order-detail-format";
import { SYSTEM_FONT } from "@/shared/theme/typography";

/** 订单状态头：大标题 + 提示语（抢单倒计时替换展示） */
export function OrderDetailStatusBar({
  scope,
  statusTitle,
  statusHint,
  showDispatchCountdown,
  dispatchCountdown,
}: {
  scope: "accept" | "place";
  statusTitle: string;
  statusHint: string;
  showDispatchCountdown: boolean;
  dispatchCountdown?: number;
}) {
  return (
    <View
      style={[
        styles.statusBlock,
        scope === "accept" && styles.acceptStatusBlock,
      ]}
    >
      <Text
        style={[
          styles.statusTitle,
          scope === "accept" && styles.acceptStatusTitle,
        ]}
      >
        {statusTitle}
      </Text>
      {statusHint || showDispatchCountdown ? (
        <Text
          style={[
            styles.statusHint,
            scope === "accept" && styles.acceptStatusHint,
          ]}
        >
          {showDispatchCountdown ? (
            dispatchCountdown === 0 ? (
              "抢单已截止"
            ) : (
              <>
                剩余{" "}
                <Text style={styles.countdownAccent}>
                  {formatCountdown(dispatchCountdown ?? 0)}
                </Text>{" "}
                停止抢单
              </>
            )
          ) : (
            statusHint
          )}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  statusBlock: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: "#FFF" },
  statusTitle: {
    color: "#161616",
    fontFamily: SYSTEM_FONT,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  statusHint: {
    color: "#222",
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    marginTop: 8,
    lineHeight: 22,
  },
  acceptStatusBlock: { paddingTop: 8, paddingBottom: 12 },
  acceptStatusTitle: { color: "#0A0A0A", fontSize: 24, fontWeight: "600", lineHeight: 30 },
  acceptStatusHint: { color: "#0A0A0A", fontSize: 14, marginTop: 12, lineHeight: 22 },
  countdownAccent: { color: "#FE1F4C" },
});
