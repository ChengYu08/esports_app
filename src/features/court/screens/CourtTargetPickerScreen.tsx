import { EmptyState } from "@/shared/ui/AsyncStates";
import { CachedImage } from "@/shared/ui/CachedImage";
import { useAuthStore } from "@esports/auth";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCourtTargetSelection } from "../court-target-selection";
import { highlightedParts, searchTicketTargets } from "../court-ticket";
import type { TicketTarget } from "../court.api";
import { COURT_FONT_FAMILY } from "../court.theme";
import { COURT_SOURCE_COLORS as C } from "../court-tokens";

const EMPTY_TARGETS: TicketTarget[] = [];

export default function CourtTargetPickerScreen() {
  const insets = useSafeAreaInsets();
  const { sessionId = "" } = useLocalSearchParams<{ sessionId?: string }>();
  const accessToken = useAuthStore((state) => state.accessToken);
  const session = useCourtTargetSelection((state) => state.sessions[sessionId]);
  const validSession = Boolean(
    accessToken && session?.ownerToken === accessToken,
  );
  const [keyword, setKeyword] = useState(session?.initialTarget?.id ?? "");
  const [search, setSearch] = useState(keyword.trim());
  const [selectedId, setSelectedId] = useState<string | null>(
    session?.initialTarget?.id ?? null,
  );
  const confirmedRef = useRef(false);
  const trimmed = keyword.trim();
  const debouncing = search !== trimmed;

  useEffect(() => {
    const timer = setTimeout(() => setSearch(trimmed), 300);
    return () => clearTimeout(timer);
  }, [trimmed]);

  const query = useQuery({
    queryKey: ["ticket-targets", accessToken, search],
    queryFn: ({ signal }) => searchTicketTargets(search, accessToken!, signal),
    enabled: validSession && !!search && !debouncing,
    staleTime: 0,
    gcTime: 60_000,
    retry: 1,
  });
  const rows =
    trimmed && !debouncing ? (query.data ?? EMPTY_TARGETS) : EMPTY_TARGETS;
  const loading =
    !!trimmed && (debouncing || query.isPending || query.isFetching);
  const selected = rows.find((item) => item.id === selectedId) ?? rows[0];
  const disabled = !validSession || !selected || loading || query.isError;
  const showIds = /^\d+$/.test(search);

  function back() {
    Keyboard.dismiss();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/court/complaint?mode=ticket");
    }
  }

  function confirm() {
    if (disabled || confirmedRef.current || !accessToken || !selected) {
      return;
    }
    if (
      useAuthStore.getState().accessToken !== accessToken ||
      !useCourtTargetSelection
        .getState()
        .confirm(sessionId, accessToken, selected)
    ) {
      return;
    }
    confirmedRef.current = true;
    back();
  }

  function changeKeyword(value: string) {
    setKeyword(value);
    setSelectedId(null);
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          onPress={back}
          style={styles.back}
        >
          <CachedImage
            source={require("../../../../assets/home/club-detail/icon-back.svg")}
            tintColor="#0A0A0A"
            style={styles.backIcon}
          />
        </Pressable>
        <Text style={styles.title}>选择诉告人</Text>
        <View style={styles.back} />
      </View>
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <CachedImage
            source={require("../../../../assets/court/ticket-search.svg")}
            style={styles.searchIcon}
          />
          <TextInput
            accessibilityLabel="搜索昵称或ID"
            value={keyword}
            onChangeText={changeKeyword}
            placeholder="搜索昵称或ID"
            placeholderTextColor="#CCCCCC"
            returnKeyType="search"
            onSubmitEditing={() => {
              setSearch(trimmed);
              Keyboard.dismiss();
            }}
            autoCorrect={false}
            autoCapitalize="none"
            editable={validSession}
            clearButtonMode="while-editing"
            style={styles.searchInput}
          />
        </View>
      </View>
      {!validSession ? (
        <View style={styles.emptyArea}>
          <EmptyState
            message="请返回发起投诉页面重新选择"
            messageStyle={styles.emptyMessage}
          />
          <Pressable
            onPress={back}
            accessibilityRole="button"
            style={styles.retry}
          >
            <Text style={styles.retryText}>返回填写</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <View style={styles.emptyArea}>
          <ActivityIndicator color="#FE1F4C" />
          <Text style={styles.loadingText}>正在查找…</Text>
        </View>
      ) : trimmed && query.isError ? (
        <View style={styles.emptyArea}>
          <EmptyState
            message={
              query.error instanceof Error
                ? query.error.message
                : "查找失败，请重试"
            }
            messageStyle={styles.emptyMessage}
          />
          <Pressable
            onPress={() => query.refetch()}
            accessibilityRole="button"
            style={styles.retry}
          >
            <Text style={styles.retryText}>重新查找</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
          extraData={selected?.id}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.list,
            rows.length === 0 && styles.emptyList,
          ]}
          renderItem={({ item, index }) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={`${item.nickname}，ID ${item.id}`}
              accessibilityState={{ selected: item.id === selected?.id }}
              onPress={() => setSelectedId(item.id)}
              style={styles.targetRow}
            >
              <CachedImage
                source={
                  item.id === selected?.id
                    ? require("../../../../assets/court/ticket-radio-on.svg")
                    : require("../../../../assets/court/ticket-radio-off.svg")
                }
                style={styles.radio}
              />
              <View style={styles.targetContent}>
                <CachedImage
                  source={
                    item.headImage
                      ? { uri: item.headImage }
                      : require("../../../../assets/coms/avatar_default.webp")
                  }
                  style={styles.avatar}
                  contentFit="cover"
                />
                <View style={styles.targetText}>
                  <Text numberOfLines={1} style={styles.nickname}>
                    <HighlightedText
                      text={item.nickname}
                      keyword={showIds ? "" : search}
                    />
                  </Text>
                  {showIds && (
                    <View style={styles.idRow}>
                      <CachedImage
                        source={require("../../../../assets/court/ticket-id.svg")}
                        style={styles.idIcon}
                      />
                      <Text numberOfLines={1} style={styles.userId}>
                        <HighlightedText text={item.id} keyword={search} />
                      </Text>
                    </View>
                  )}
                </View>
                {index < rows.length - 1 && <View style={styles.separator} />}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              style={styles.empty}
              messageStyle={styles.emptyMessage}
              message={
                trimmed
                  ? "未找到用户，请核对昵称或ID"
                  : "请输入诉告人的昵称或ID查找"
              }
              illustration={
                <View style={styles.searchIllustration}>
                  <CachedImage
                    source={require("../../../../assets/court/ticket-search-mirror.svg")}
                    style={styles.searchMirror}
                  />
                  <CachedImage
                    source={require("../../../../assets/court/ticket-search-panda.svg")}
                    style={styles.searchPanda}
                  />
                </View>
              }
            />
          }
          ListFooterComponent={
            rows.length ? <Text style={styles.end}>没有更多啦～</Text> : null
          }
        />
      )}
      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={confirm}
          style={[styles.confirm, disabled && styles.disabled]}
        >
          <Text style={styles.confirmText}>确认</Text>
        </Pressable>
      </View>
    </View>
  );
}

function HighlightedText({ text, keyword }: { text: string; keyword: string }) {
  return (
    <>
      {highlightedParts(text, keyword).map((part, index) => (
        <Text key={index} style={part.match ? styles.highlight : undefined}>
          {part.text}
        </Text>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  back: { width: 40, height: 44, justifyContent: "center" },
  backIcon: { width: 24, height: 24 },
  title: {
    fontFamily: COURT_FONT_FAMILY,
    color: C.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  searchSection: {
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: C.fill,
  },
  searchIcon: { width: 20, height: 20 },
  searchInput: {
    flex: 1,
    minHeight: 36,
    paddingVertical: 7,
    paddingHorizontal: 0,
    fontFamily: COURT_FONT_FAMILY,
    color: C.text,
    fontSize: 14,
    lineHeight: 22,
  },
  list: { flexGrow: 1, paddingTop: 8 },
  emptyList: { backgroundColor: C.surface, paddingTop: 0 },
  emptyArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.surface,
    paddingHorizontal: 16,
  },
  empty: { flex: 1, width: 247 },
  searchIllustration: { width: 120, height: 120 },
  searchMirror: {
    position: "absolute",
    left: 0,
    top: -7,
    width: 115.82,
    height: 128.52,
  },
  searchPanda: {
    position: "absolute",
    left: 15.79,
    top: 43.54,
    width: 79.13,
    height: 69.25,
  },
  emptyMessage: {
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    lineHeight: 18,
    color: C.empty,
  },
  loadingText: {
    fontFamily: COURT_FONT_FAMILY,
    color: C.empty,
    fontSize: 12,
    marginTop: 12,
  },
  retry: { padding: 12 },
  retryText: { fontFamily: COURT_FONT_FAMILY, fontSize: 14, color: C.brand },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    backgroundColor: C.surface,
  },
  radio: { width: 20, height: 20 },
  targetContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "#EBEBEB",
    backgroundColor: C.fill,
  },
  targetText: { flex: 1, gap: 4 },
  nickname: {
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    color: C.text,
  },
  idRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  idIcon: { width: 16, height: 16 },
  userId: {
    flex: 1,
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    lineHeight: 18,
    color: C.textMuted,
  },
  separator: {
    position: "absolute",
    bottom: 0,
    left: 68,
    right: 0,
    height: 0.5,
    backgroundColor: C.border,
  },
  highlight: { color: C.brand },
  end: {
    paddingVertical: 24,
    textAlign: "center",
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 12,
    lineHeight: 18,
    color: C.empty,
  },
  footer: { backgroundColor: C.surface, paddingHorizontal: 16, paddingTop: 8 },
  confirm: {
    minHeight: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.brand,
  },
  disabled: { backgroundColor: C.brandDisabled },
  confirmText: {
    fontFamily: COURT_FONT_FAMILY,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    color: "#FFFFFF",
  },
});
