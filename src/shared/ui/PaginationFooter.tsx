import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@/shared/theme/tokens";

type PaginationFooterProps = {
  loading: boolean;
  hasMore: boolean;
  /** 已加载页数，只有一页（从未翻页）时不展示收尾文案 */
  pageCount?: number;
  style?: StyleProp<ViewStyle>;
};

// 列表分页统一底部提示：加载中转圈，翻过多页且没有更多时展示文案。
// 分页失败（hasNextPage 仍为 true 且未在加载）时本组件不渲染，失败反馈由调用方负责（如重试按钮或下拉刷新兜底）
export function PaginationFooter({ loading, hasMore, pageCount = 1, style }: PaginationFooterProps) {
  if (loading) {
    return (
      <View style={[styles.wrap, style]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  if (hasMore || pageCount <= 1) {
    return null;
  }
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.endText}>没有更多啦～</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", alignItems: "center", justifyContent: "center", paddingVertical: 6 },
  endText: { color: "#CCCCCC", fontSize: 12, lineHeight: 16, textAlign: "center" },
});
