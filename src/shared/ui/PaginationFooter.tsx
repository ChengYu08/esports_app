import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@/shared/theme/tokens";

type PaginationFooterProps = {
  loading: boolean;
  hasMore: boolean;
  /** 已加载页数，只有一页（从未翻页）时不展示收尾文案 */
  pageCount?: number;
  /** 上拉加载失败：展示「加载失败，请重新加载」，点击红色文案触发 onRetry */
  failed?: boolean;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
};

// 列表分页统一底部提示：加载中文案、失败重试、翻过多页且没有更多时收尾。
// 失败态优先于收尾态（失败时 hasNextPage 仍为 true），由调用方传入失败信号与重试回调
export function PaginationFooter({
  loading,
  hasMore,
  pageCount = 1,
  failed = false,
  onRetry,
  style,
}: PaginationFooterProps) {
  if (loading) {
    return (
      <View style={[styles.wrap, style]}>
        <Text style={styles.text}>正在加载中...</Text>
      </View>
    );
  }
  if (failed) {
    return (
      <View style={[styles.wrap, style]}>
        <Text style={styles.text}>加载失败，</Text>
        <Pressable hitSlop={8} onPress={onRetry}>
          <Text style={[styles.text, styles.retryText]}>请重新加载</Text>
        </Pressable>
      </View>
    );
  }
  if (hasMore || pageCount <= 1) {
    return null;
  }
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.text}>没有更多啦～</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  text: { color: colors.textTertiary, fontSize: 12, lineHeight: 18 },
  retryText: { color: colors.brand },
});
