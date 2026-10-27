import { colors, radius, spacing } from "@/shared/theme/tokens";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  formatManagementNumber as format,
  type WalletEntry,
} from "../api/companion-management.contract";

export const CompanionIncomeEntry = memo(function CompanionIncomeEntry({
  entry,
}: {
  entry: WalletEntry;
}) {
  const amountColor =
    Number(entry.amount) < 0 ? styles.negative : styles.positive;
  return (
    <View style={styles.card}>
      <View style={styles.section}>
        <View style={styles.amountRow}>
          <Text style={styles.label}>竹子变化</Text>
          <View style={styles.amountGroup}>
            <Text style={[styles.amount, amountColor]}>
              {Number(entry.amount) > 0 ? "+" : ""}
              {format(entry.amount)}
            </Text>
            <Text style={[styles.unit, amountColor]}>竹子</Text>
          </View>
        </View>
        {/* 当前的余额接口不会返回单项条目的余额，无数据时按 0 展示。 */}
        <LedgerRow label="剩余竹子" value={format(entry.remainAmount ?? 0)} />
        <LedgerRow
          label="类型"
          value={entry.transactionTypeDesc || entry.transactionType || "未知"}
        />
      </View>
      <View style={styles.divider} />
      <View style={styles.section}>
        <LedgerRow label="订单号" value={entry.relatedOrderNo || "无"} />
        <LedgerRow
          label="流水时间"
          value={entry.createTime?.replace("T", " ").slice(0, 16) || "无"}
        />
        {entry.remark ? <LedgerRow label="备注" value={entry.remark} /> : null}
      </View>
    </View>
  );
});

function LedgerRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  section: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 30,
    paddingVertical: spacing.xs,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    minHeight: 32,
    paddingVertical: spacing.xs,
  },
  label: { width: 112, fontSize: 12, lineHeight: 18, color: "#7F7F80" },
  value: {
    flex: 1,
    color: "#0D0D0F",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
  },
  amountGroup: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  amount: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  unit: { fontSize: 12, lineHeight: 20 },
  positive: { color: "#FE1F4C" },
  negative: { color: "#14A357" },
  divider: {
    marginHorizontal: spacing.md,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E9E9EB",
  },
});
