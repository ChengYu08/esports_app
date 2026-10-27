import { ChevronLeft24Regular, Search24Regular } from "@fluentui/react-native-icons";
import { useHomeGames } from "@/features/home/hooks/use-home-data";
import { EmptyState } from "@/shared/ui/AsyncStates";
import { useAuthStore } from "@esports/auth";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-root-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CourtSourceCard } from "../components/CourtSourceCard";
import { useCourtSourceSelection } from "../court-source-selection";
import {
  confirmCourtSource,
  courtReviewsForOrder,
  courtSourceGameIcon,
  courtSourceKey,
  filterCourtOrders,
  groupCourtOrders,
  loadCourtSources,
} from "../court-sources";
import type { CourtSource } from "../court.api";
import { COURT_FONT_FAMILY } from "../court.theme";
import { COURT_SOURCE_COLORS as C } from "../court-tokens";

const EMPTY_SOURCES: CourtSource[] = [];

export function CourtOrderPickerScreen() {
  return <CourtSourcePickerScreen step="orders" />;
}

export function CourtReviewPickerScreen() {
  return <CourtSourcePickerScreen step="reviews" />;
}

function CourtSourcePickerScreen({ step }: { step: "orders" | "reviews" }) {
  const { sessionId = "" } = useLocalSearchParams<{ sessionId?: string }>();
  const accessToken = useAuthStore((state) => state.accessToken);
  const session = useCourtSourceSelection((state) => state.sessions[sessionId]);
  const insets = useSafeAreaInsets();
  const [keyword, setKeyword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const busyRef = useRef(false);
  const focusedRef = useRef(true);
  const isReview = step === "reviews";
  const validSession = Boolean(
    session && accessToken && session.ownerToken === accessToken,
  );
  const caseType = session?.caseType ?? "DELETE_REVIEW";
  const title = isReview
    ? "选择差评"
    : caseType === "DELETE_REVIEW"
      ? "选择差评所在订单"
      : "选择处理订单";
  const query = useQuery({
    queryKey: ["court-sources", caseType, accessToken],
    queryFn: ({ signal }) => loadCourtSources(caseType, accessToken!, signal),
    enabled: validSession,
    staleTime: 30_000,
    gcTime: 60_000,
    retry: 1,
  });
  const games = useHomeGames();
  const sources = query.data ?? EMPTY_SOURCES;
  const rows = useMemo(
    () =>
      isReview
        ? courtReviewsForOrder(sources, session?.orderId ?? "")
        : filterCourtOrders(groupCourtOrders(sources), keyword),
    [isReview, keyword, session?.orderId, sources],
  );
  const selected =
    rows.find((source) =>
      isReview
        ? String(source.reviewId) === session?.reviewId
        : String(source.orderId) === session?.orderId,
    ) ?? rows[0];

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      return () => {
        focusedRef.current = false;
      };
    }, []),
  );

  function back() {
    if (busyRef.current) {
      return;
    }
    Keyboard.dismiss();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/court/complaint?mode=court");
    }
  }

  function choose(source: CourtSource) {
    if (busyRef.current) {
      return;
    }
    if (isReview) {
      useCourtSourceSelection
        .getState()
        .selectReview(sessionId, String(source.reviewId));
    } else {
      useCourtSourceSelection
        .getState()
        .selectOrder(sessionId, String(source.orderId));
    }
  }

  async function confirm() {
    if (!selected || !session || !validSession || busyRef.current) {
      return;
    }
    Keyboard.dismiss();
    choose(selected);
    if (!isReview && caseType === "DELETE_REVIEW") {
      router.push({ pathname: "/court/select-review", params: { sessionId } });
      return;
    }
    busyRef.current = true;
    setConfirming(true);
    try {
      const source = await confirmCourtSource(
        caseType,
        selected,
        session.ownerToken,
      );
      if (!focusedRef.current) {
        return;
      }
      if (
        !useCourtSourceSelection
          .getState()
          .confirm(sessionId, source, session.ownerToken)
      ) {
        throw new Error("选择信息已变化，请返回重试");
      }
      router.dismiss(isReview ? 2 : 1);
    } catch (error) {
      if (focusedRef.current) {
        Toast.show(
          error instanceof Error ? error.message : "选择失败，请重试",
          { duration: Toast.durations.SHORT, position: Toast.positions.CENTER },
        );
      }
    } finally {
      busyRef.current = false;
      setConfirming(false);
    }
  }

  const disabled =
    !validSession ||
    !selected ||
    query.isPending ||
    query.isError ||
    confirming;
  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, height: insets.top + 44 },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          disabled={confirming}
          onPress={back}
          style={styles.back}
        >
          <ChevronLeft24Regular color="#0D0D0F" width={24} height={24} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.back} />
      </View>
      {!isReview && (
        <View style={styles.searchSection}>
          <View style={styles.searchBox}>
            <Search24Regular color="#0D0D0F" width={16} height={16} style={styles.searchIcon} />
            <TextInput
              accessibilityLabel="搜索订单ID"
              value={keyword}
              onChangeText={setKeyword}
              editable={!confirming}
              placeholder="搜索订单ID"
              placeholderTextColor="#CCCCCC"
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
              autoCorrect={false}
              style={styles.searchInput}
            />
            {!!keyword && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="清空搜索"
                onPress={() => setKeyword("")}
                disabled={confirming}
                hitSlop={8}
                style={styles.clearButton}
              >
                <Text style={styles.clearText}>×</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
      {!validSession ? (
        <View style={styles.message}>
          <Text style={styles.messageText}>请返回发起投诉页面重新选择订单</Text>
        </View>
      ) : query.isPending ? (
        <View style={styles.message}>
          <ActivityIndicator color="#FE1F4C" />
          <Text style={styles.messageText}>正在加载可选订单…</Text>
        </View>
      ) : query.isError ? (
        <View style={styles.message}>
          <Text style={styles.messageText}>
            {query.error instanceof Error
              ? query.error.message
              : "订单加载失败"}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => query.refetch()}
            style={styles.retry}
          >
            <Text style={styles.retryText}>重新加载</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
          extraData={{ selected, games: games.data }}
          keyExtractor={(source) =>
            isReview ? courtSourceKey(source) : String(source.orderId)
          }
          renderItem={({ item }) => (
            <CourtSourceCard
              source={item}
              gameIconUrl={courtSourceGameIcon(item, games.data)}
              kind={isReview ? "review" : "order"}
              selected={item === selected}
              disabled={confirming}
              keyword={keyword}
              onSelect={() => choose(item)}
            />
          )}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              style={styles.empty}
              message={
                isReview
                  ? "该订单暂无可选差评"
                  : keyword.trim()
                    ? "没有找到匹配的订单"
                    : "暂无可选订单"
              }
            />
          }
          ListFooterComponent={
            rows.length > 0 ? (
              <Text style={styles.end}>没有更多啦～</Text>
            ) : null
          }
        />
      )}
      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        {isReview && (
          <Pressable
            accessibilityRole="button"
            disabled={confirming}
            onPress={back}
            style={styles.previous}
          >
            <Text style={styles.previousText}>上一步</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled, busy: confirming }}
          disabled={disabled}
          onPress={confirm}
          style={[styles.submit, disabled && styles.disabled]}
        >
          {confirming ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>
              {!isReview && caseType === "DELETE_REVIEW" ? "下一步" : "确认"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: C.surface,
    paddingHorizontal: 16,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  backIcon: { width: 24, height: 24 },
  title: {
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: C.text,
  },
  searchSection: {
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingBottom: 16,
    paddingTop: 8,
  },
  searchBox: {
    backgroundColor: C.fill,
    borderRadius: 8,
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  searchIcon: { width: 16, height: 16 },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 0,
    color: C.text,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    lineHeight: 20,
  },
  clearButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    height: 14,
    width: 14,
    backgroundColor: "#979799",
  },
  clearText: { color: "#FFFFFF", fontSize: 12, lineHeight: 14 },
  listContent: { flexGrow: 1 },
  message: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  messageText: {
    color: C.textMuted,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  retry: { padding: 12 },
  retryText: { color: C.brand, fontFamily: COURT_FONT_FAMILY, fontSize: 14 },
  empty: { flex: 1 },
  end: {
    color: C.footerMuted,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    paddingVertical: 16,
  },
  footer: {
    backgroundColor: C.surface,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  submit: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: C.brand,
  },
  disabled: { backgroundColor: C.brandDisabled },
  submitText: {
    color: "#FFFFFF",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
  previous: {
    width: 104,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    alignItems: "center",
    justifyContent: "center",
  },
  previousText: {
    color: C.text,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    lineHeight: 22,
  },
});
