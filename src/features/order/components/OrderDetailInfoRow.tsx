import { Copy16Regular } from "@fluentui/react-native-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";

/** 订单详情信息行：左侧标签、右侧值，支持复制按钮与陪玩端样式 */
export function OrderDetailInfoRow({
  label,
  value,
  copy,
  onCopy,
  acceptStyle = false,
  multiline = false,
}: {
  label: string;
  value: string;
  copy?: boolean;
  onCopy?: () => void;
  acceptStyle?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={[styles.infoRow, multiline && styles.multilineInfoRow]}>
      <Text style={[styles.label, acceptStyle && styles.acceptLabel]}>
        {label}
      </Text>
      <View style={styles.infoValue}>
        <Text
          style={[
            styles.value,
            (label === "实付款" || label === "合计") && styles.amount,
            acceptStyle && styles.acceptValue,
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
  label: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 16 },
  acceptLabel: { width: 70, fontSize: 14, lineHeight: 22 },
  infoValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "70%",
  },
  value: {
    color: "#161616",
    fontSize: 12,
    textAlign: "right",
  },
  acceptValue: { flex: 1, fontSize: 14, lineHeight: 22 },
  multilineInfoRow: { alignItems: "flex-start", minHeight: 44 },
  multilineValue: { textAlign: "right" },
  amount: { color: "#F02543", fontWeight: "600" },
  copy: { width: 16, height: 16 },
});
