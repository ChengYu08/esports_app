import { colors, radius, spacing } from "@/shared/theme/tokens";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ChargeRecord } from "../api/recharge.api";

function formatAmount(value: number | string | undefined): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "--";
  return String(num);
}

function formatTime(value?: string): string {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 16);
}

/** chargeRecords 仅含充值/退款；无 transactionType 时按金额正负推断类型文案 */
function resolveTypeLabel(amount: number, remark?: string): string {
  if (amount < 0) return "充值退款";
  if (amount > 0) return "充值钻石";
  return remark?.trim() || "-";
}

export const MyDiamondsEntry = memo(function MyDiamondsEntry({
  entry,
}: {
  entry: ChargeRecord;
}) {
  const amount = Number(entry.amount ?? 0);
  const isPositive = amount >= 0;
  const amountColor = isPositive ? styles.positive : styles.negative;
  const title = entry.remark?.trim() || "钻石变动";

  return (
    <View style={styles.card}>
      <View style={styles.section}>
        <View style={styles.amountRow}>
          <Text style={styles.label} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.amountGroup}>
            <Text style={[styles.amount, amountColor]}>
              {isPositive ? "+" : ""}
              {formatAmount(entry.amount)}
            </Text>
            <Text style={[styles.unit, amountColor]}>钻石</Text>
          </View>
        </View>
        <LedgerRow label="剩余钻石" value={formatAmount(entry.balanceAfter)} />
        <LedgerRow label="类型" value={resolveTypeLabel(amount, entry.remark)} />
      </View>
      <View style={styles.divider} />
      <View style={styles.section}>
        <LedgerRow label="订单ID" value={entry.relatedOrderNo?.trim() || "-"} />
        <LedgerRow label="流水时间" value={formatTime(entry.createTime)} />
      </View>
    </View>
  );
});

function LedgerRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>
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
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E9E9EB",
  },
});
