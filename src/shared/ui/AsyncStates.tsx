import { Image, type ImageSource } from "expo-image";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { colors, radius, spacing } from "@/shared/theme/tokens";
import { LOAD_FAILED_FALLBACK_URI, OFFLINE_FALLBACK_URI } from "@/shared/ui/fallback-illustration-data";
import { SkeletonList } from "@/shared/ui/Skeleton";

type StateProps = { message?: string };
type EmptyStateProps = StateProps & {
  hint?: string;
  style?: StyleProp<ViewStyle>;
  messageStyle?: StyleProp<TextStyle>;
  testID?: string;
  illustration?: ReactNode;
};

const emptyStateIllustration = require("../../../assets/svgs/empty-state-illustration.svg");

export function LoadingState({ message = "加载中…", style, messageStyle }: StateProps & { style?: StyleProp<ViewStyle>; messageStyle?: StyleProp<TextStyle> }) {
  return (
    <View style={[styles.loadingState, style]}>
      <SkeletonList message={message} />
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={[styles.loadingMessage, messageStyle]}>{message}</Text>
      </View>
    </View>
  );
}

export function EmptyState({ message = "这里空无一物～", hint, style, messageStyle, testID, illustration }: EmptyStateProps) {
  return (
    <View testID={testID} style={[styles.emptyState, style]}>
      {illustration ?? <Image accessibilityIgnoresInvertColors contentFit="contain" source={emptyStateIllustration} style={styles.emptyIllustration} />}
      <Text style={[styles.emptyMessage, messageStyle]}>{message}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

export function ErrorState({ message = "加载失败，请重试", onRetry, messageStyle, retryTextStyle }: StateProps & { onRetry: () => void; messageStyle?: StyleProp<TextStyle>; retryTextStyle?: StyleProp<TextStyle> }) {
  return (
    <View style={styles.errorWrap}>
      <Text style={[styles.message, messageStyle]}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
        <Text style={[styles.retryText, retryTextStyle]}>重试</Text>
      </Pressable>
    </View>
  );
}

/**
 * 列表兜底态（Figma「Default prompt」）：熊猫插画 120×120 + 12/18 文案，在列表空白区垂直居中。
 * 根节点 flexGrow 居中，需列表 contentContainerStyle 提供 flexGrow 才能撑满剩余空间。
 */
export type ListFallbackKind = "offline" | "empty" | "filterEmpty" | "loadFailed";

// 断网 / 加载失败两态会在网络不可用时展示，插画不能依赖 Metro 下载，
// 其余两态只会在拿到网络响应后出现，继续用共享资源。
const fallbackIllustrations: Record<ListFallbackKind, ImageSource | number> = {
  offline: { uri: OFFLINE_FALLBACK_URI },
  empty: emptyStateIllustration,
  filterEmpty: emptyStateIllustration,
  loadFailed: { uri: LOAD_FAILED_FALLBACK_URI },
};

const fallbackMessages: Record<ListFallbackKind, string> = {
  offline: "网络丢失，请检查网络设置",
  empty: "这里空无一物～",
  filterEmpty: "暂无筛选结果，请调整筛选条件",
  loadFailed: "信息量太大，给我点时间～",
};

export function ListFallbackState({
  kind,
  message,
  onRetry,
  style,
  messageStyle,
  testID,
}: {
  kind: ListFallbackKind;
  message?: string;
  /** 仅 loadFailed 态展示「刷新」按钮（Figma 2739-87505） */
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
  messageStyle?: StyleProp<TextStyle>;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.fallbackState, style]}>
      <Image accessibilityIgnoresInvertColors contentFit="contain" source={fallbackIllustrations[kind]} style={styles.emptyIllustration} />
      <Text style={[styles.emptyMessage, messageStyle]}>{message ?? fallbackMessages[kind]}</Text>
      {kind === "loadFailed" && onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.fallbackRetry}>
          <Text style={styles.fallbackRetryText}>刷新</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingState: { width: "100%", paddingTop: spacing.lg },
  loadingMessage: { color: colors.textMuted, fontSize: 12, textAlign: "center", paddingTop: spacing.lg },
  message: { color: colors.textMuted, fontSize: 14, textAlign: "center", paddingTop: 40 },
  emptyState: { width: "100%", maxWidth: "100%", minHeight: 240, alignSelf: "center", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  emptyIllustration: { width: 120, height: 120 },
  emptyMessage: { width: "100%", color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  emptyHint: { width: "100%", color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  errorWrap: { alignItems: "center", paddingTop: 60 },
  retry: { marginTop: spacing.md, borderWidth: 1, borderColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 5 },
  retryText: { color: colors.brand, fontSize: 13 },
  fallbackState: { width: "100%", flexGrow: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  // Figma 文案与刷新按钮间距 24，根节点 gap 已占 8
  fallbackRetry: { marginTop: 16, borderWidth: 1, borderColor: colors.brand, borderRadius: 6, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 4 },
  fallbackRetryText: { color: colors.brand, fontSize: 14, lineHeight: 22, fontWeight: "500" },
});
