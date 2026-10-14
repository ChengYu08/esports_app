import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { colors, radius, spacing } from "@/shared/theme/tokens";
import { SkeletonList } from "@/shared/ui/Skeleton";

type StateProps = { message?: string };
type EmptyStateProps = StateProps & { hint?: string; style?: StyleProp<ViewStyle>; testID?: string };

const emptyStateIllustration = require("../../../assets/coms/empty-state-illustration.svg");

export function LoadingState({ message = "加载中…", style }: StateProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.loadingState, style]}>
      <SkeletonList message={message} />
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.loadingMessage}>{message}</Text>
      </View>
    </View>
  );
}

export function EmptyState({ message = "这里空无一物～", hint, style, testID }: EmptyStateProps) {
  return (
    <View testID={testID} style={[styles.emptyState, style]}>
      <Image accessibilityIgnoresInvertColors contentFit="contain" source={emptyStateIllustration} style={styles.emptyIllustration} />
      <Text style={styles.emptyMessage}>{message}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
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
  loadingState: { width: "100%", paddingTop: spacing.lg },
  loadingMessage: { fontFamily: DOUYIN_SANS, color: colors.textMuted, fontSize: 12, textAlign: "center", paddingTop: spacing.lg },
  message: { fontFamily: DOUYIN_SANS, color: colors.textMuted, fontSize: 14, textAlign: "center", paddingTop: 40 },
  emptyState: { width: "100%", maxWidth: "100%", minHeight: 240, alignSelf: "center", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  emptyIllustration: { width: 120, height: 120 },
  emptyMessage: { width: "100%", fontFamily: DOUYIN_SANS, color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  emptyHint: { width: "100%", fontFamily: DOUYIN_SANS, color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  errorWrap: { alignItems: "center", paddingTop: 60 },
  retry: { marginTop: spacing.md, borderWidth: 1, borderColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 5 },
  retryText: { fontFamily: DOUYIN_SANS, color: colors.brand, fontSize: 13 },
});
