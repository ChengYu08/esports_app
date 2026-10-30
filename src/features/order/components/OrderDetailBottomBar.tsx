import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { OrderAction } from "@/features/order/order.types";
import { SYSTEM_FONT } from "@/shared/theme/typography";

const ACTION_GRADIENT = ["#FF1F2E", "#FF1F69"] as const;
const ACTION_GRADIENT_START = { x: 0, y: 0 } as const;
const ACTION_GRADIENT_END = { x: 1, y: 0.21 } as const;

/** 详情页底部操作按钮组 */
export function OrderDetailBottomBar({
  scope,
  actions,
  pending,
  onAction,
}: {
  scope: "accept" | "place";
  actions: readonly OrderAction[];
  pending: boolean;
  onAction: (action: OrderAction) => void;
}) {
  const insets = useSafeAreaInsets();
  if (!actions.length) {
    return null;
  }
  return (
    <View
      style={[
        styles.bottom,
        scope === "accept" && styles.acceptBottom,
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      {actions.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityState={{ disabled: pending }}
          disabled={pending}
          onPress={() => onAction(action)}
          style={[
            styles.outlineButton,
            scope === "accept" && styles.acceptOutlineButton,
            actions.length > 1 && styles.bottomAction,
            scope === "accept" && actions.length > 1 && action.variant === "secondary" && styles.acceptSecondaryButton,
            action.variant === "primary" && styles.primaryButton,
            action.variant === "primary" &&
              scope === "accept" &&
              styles.acceptPrimaryButton,
          ]}
        >
          {action.variant === "primary" ? (
            <LinearGradient
              colors={ACTION_GRADIENT}
              start={ACTION_GRADIENT_START}
              end={ACTION_GRADIENT_END}
              style={styles.primaryGradient}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.primaryText,
                  scope === "accept" && styles.acceptActionText,
                ]}
              >
                {pending ? "处理中..." : action.label}
              </Text>
            </LinearGradient>
          ) : (
            <Text
              numberOfLines={1}
              style={[
                styles.outlineText,
                scope === "accept" && styles.acceptActionText,
              ]}
            >
              {pending ? "处理中..." : action.label}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bottom: {
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    borderTopWidth: 14,
    borderTopColor: "#F7F7F7",
  },
  acceptBottom: { borderTopWidth: 0, paddingTop: 8, gap: 12 },
  // 多按钮均分一行时收紧内边距，保证窄屏（<360pt）下四字按钮不换行。
  bottomAction: { flex: 1, width: undefined, minWidth: 0, paddingHorizontal: 8 },
  acceptSecondaryButton: { flexGrow: 0, flexShrink: 0, flexBasis: 104, width: 104 },
  outlineButton: {
    width: "100%",
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E7E7E7",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptOutlineButton: { height: 42, borderRadius: 8, borderColor: "#EBEBEB" },
  acceptPrimaryButton: { borderRadius: 8, overflow: "hidden" },
  outlineText: {
    color: "#111",
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    fontWeight: "600",
  },
  primaryButton: {
    paddingHorizontal: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    borderRadius: 8,
    overflow: "hidden",
  },
  primaryGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#FFF",
    fontFamily: SYSTEM_FONT,
    fontSize: 17,
    fontWeight: "600",
  },
  acceptActionText: { fontSize: 14, fontWeight: "500", lineHeight: 22 },
});
