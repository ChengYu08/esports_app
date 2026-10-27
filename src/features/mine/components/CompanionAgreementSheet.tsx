import { useAuthStore } from "@esports/auth";
import { Dismiss24Regular } from "@fluentui/react-native-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "@/shared/theme/tokens";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { companionAgreementApi } from "../api/companion-agreement.api";

/** 确认状态按账号存储在服务端，与 Web 端共用。 */
export function CompanionAgreementSheet() {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  const queryKey = ["companion-agreement-status", userId, "user_playmate"];
  const [visible, setVisible] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const pending = useRef(false);
  const { data, error, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: ({ signal }) => companionAgreementApi.status(token!, signal),
    enabled: Boolean(token && userId),
    staleTime: 0,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const protocol = data?.protocol;
  const canAgree = Boolean(protocol) && !isFetching && !error && !submitting;
  const confirm = async () => {
    if (!canAgree || !protocol || !token || pending.current) return;
    pending.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      await companionAgreementApi.accept(token, protocol);
      await queryClient.cancelQueries({ queryKey });
      const current = useAuthStore.getState();
      if (current.accessToken !== token || current.user?.id !== userId) return;
      queryClient.setQueryData(queryKey, { accepted: true, protocol: null });
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "协议确认失败，请重试";
      setSubmitError(message);
      if (message === "协议已更新，请重新阅读后确认") await refetch();
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  };

  const leave = () => {
    if (pending.current) return;
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/mine");
  };

  if (!token || !userId || (!data && !error) || data?.accepted) return null;

  return (
    <BottomSheet
      visible={visible}
      onClose={leave}
      dismissOnBackdropPress={false}
      backdropStyle={styles.backdrop}
      contentStyle={styles.sheet}
    >
      <View accessibilityViewIsModal style={styles.content}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            陪玩师协议确认
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭协议并返回"
            disabled={submitting}
            onPress={leave}
            style={styles.close}
          >
            <Dismiss24Regular color="#CCCCCC" width={24} height={24} />
          </Pressable>
        </View>
        <View style={styles.readingArea}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.document}
          >
            {isFetching ? (
              <View style={styles.state}>
                <ActivityIndicator color={colors.brand} />
                <Text style={styles.stateText}>正在加载协议…</Text>
              </View>
            ) : error ? (
              <View style={styles.state}>
                <Text accessibilityRole="alert" style={styles.stateText}>
                  {error.message}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void refetch()}
                  style={styles.retry}
                >
                  <Text style={styles.retryText}>重新加载</Text>
                </Pressable>
              </View>
            ) : protocol ? (
              <Text selectable style={styles.body}>
                {protocol.content}
              </Text>
            ) : null}
          </ScrollView>
        </View>
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          {submitError ? (
            <Text accessibilityRole="alert" style={styles.submitError}>
              {submitError}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canAgree }}
            disabled={!canAgree}
            onPress={() => void confirm()}
            style={({ pressed }) => [
              styles.agree,
              !canAgree && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.agreeText}>
              {submitting ? "正在确认…" : "我已阅读并同意陪玩师协议"}
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(0,0,0,0.7)" },
  sheet: {
    height: 690,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: "hidden",
  },
  content: { flex: 1 },
  header: {
    minHeight: 56,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    flex: 1,
    color: "#0A0A0A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  readingArea: {
    flex: 1,
    paddingVertical: spacing.sm,
    backgroundColor: "#F7F7F7",
  },
  scroll: { flex: 1, backgroundColor: colors.surface },
  document: { flexGrow: 1, padding: spacing.lg },
  body: { color: "#0A0A0A", fontSize: 14, lineHeight: 22 },
  state: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  stateText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  retry: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
  },
  retryText: { color: "#1B84E0", fontSize: 14 },
  footer: { paddingTop: spacing.sm, paddingHorizontal: spacing.lg },
  agree: {
    minHeight: 42,
    borderRadius: radius.md,
    backgroundColor: "#FE1F4C",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: spacing.sm,
  },
  agreeText: {
    color: colors.surface,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    textAlign: "center",
  },
  submitError: {
    color: "#FE1F4C",
    fontSize: 13,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
});
