import { Copy16Regular } from "@fluentui/react-native-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SYSTEM_FONT } from "@/shared/theme/typography";

/** 订单详情信息行：左侧标签、右侧值，支持复制按钮与陪玩端样式 */
export function OrderDetailInfoRow({
  label,
  value,
  copy,
  onCopy,
  acceptStyle = false,
  multiline = false,
  amount = label === "实付款" || label === "合计",
}: {
  label: string;
  value: string;
  copy?: boolean;
  onCopy?: () => void;
  acceptStyle?: boolean;
  multiline?: boolean;
  amount?: boolean;
}) {
  return (
    <View style={[styles.infoRow, acceptStyle && styles.acceptRow, multiline && styles.multilineInfoRow]}>
      <Text style={[styles.label, acceptStyle && styles.acceptLabel]}>
        {label}
      </Text>
      <View style={[styles.infoValue, acceptStyle && styles.acceptInfoValue]}>
        <Text
          style={[
            styles.value,
            acceptStyle && styles.acceptValue,
            amount && styles.amount,
            acceptStyle && amount && styles.acceptAmount,
            multiline && styles.multilineValue,
          ]}
        >
          {value}
        </Text>
        {copy ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="复制订单编号"
            hitSlop={8}
            onPress={onCopy}
          >
            <Copy16Regular
              color="#808080"
              width={16}
              height={16}
              style={styles.copy}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 34,
  },
  acceptRow: { gap: 12, paddingVertical: 6 },
  label: { color: "#999", fontFamily: SYSTEM_FONT, fontSize: 16 },
  acceptLabel: { width: 112, flexShrink: 1, color: "#808080", fontSize: 14, lineHeight: 22 },
  infoValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "70%",
  },
  value: {
    color: "#161616",
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    textAlign: "right",
  },
  acceptInfoValue: { flex: 1, minWidth: 0, maxWidth: undefined, gap: 4, justifyContent: "flex-end" },
  acceptValue: { flexShrink: 1, color: "#0A0A0A", fontSize: 14, lineHeight: 22 },
  multilineInfoRow: { alignItems: "flex-start", minHeight: 44 },
  multilineValue: { textAlign: "right" },
  amount: { color: "#FE1F4C", fontWeight: "600" },
  acceptAmount: { fontWeight: "400" },
  copy: { width: 16, height: 16 },
});
