import { Pressable, StyleSheet, Text, View } from "react-native";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { colors, radius, spacing } from "@/shared/theme/tokens";

type StateProps = { message?: string };

export function LoadingState({ message = "加载中…" }: StateProps) {
  return <Text style={styles.message}>{message}</Text>;
}

export function EmptyState({ message = "暂无数据" }: StateProps) {
  return <Text style={styles.message}>{message}</Text>;
}

export function ErrorState({ message = "加载失败，请重试", onRetry }: StateProps & { onRetry: () => void }) {
  return (
    <View style={styles.errorWrap}>
      <Text style={styles.message}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
        <Text style={styles.retryText}>重试</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  message: { fontFamily: DOUYIN_SANS, color: colors.textMuted, fontSize: 14, textAlign: "center", paddingTop: 40 },
  errorWrap: { alignItems: "center", paddingTop: 60 },
  retry: { marginTop: spacing.md, borderWidth: 1, borderColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 5 },
  retryText: { fontFamily: DOUYIN_SANS, color: colors.brand, fontSize: 13 },
});
