import { useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@esports/auth";
import { cancelClubJoin, fetchClubJoinState, fetchJoinClubs, submitClubJoin } from "@/features/mine/api/club-join.api";
import { clubJoinStateKey } from "@/features/mine/components/JoinClubEntry";
import { useClubJoinRefresh } from "@/features/mine/hooks/use-club-join-refresh";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { showToast } from "@/shared/ui/app-toast";

const backIcon = require("../../../../assets/svgs/icon-back.svg");

export default function JoinClubScreen() {
  const userId = useAuthStore((state) => state.user?.id);
  return <JoinClubContent key={userId ?? "guest"} />;
}

function JoinClubContent() {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const stateQuery = useQuery({ queryKey: clubJoinStateKey(token), queryFn: () => fetchClubJoinState(token as string), enabled: Boolean(token && user?.id) });
  const { refetch } = stateQuery;
  useClubJoinRefresh(refetch);
  const pending = stateQuery.data?.status === "PENDING";
  const approved = stateQuery.data?.status === "APPROVED";
  const eligible = Boolean(token && user?.id && !user.clubInfo?.id && user.isRealName === 1 && stateQuery.isSuccess && !stateQuery.isFetching && !pending && !approved);
  const clubsQuery = useInfiniteQuery({
    queryKey: ["club-join", "clubs", keyword],
    queryFn: ({ pageParam, signal }) => fetchJoinClubs(pageParam, keyword, signal),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => pages.flatMap((page) => page.records).length < last.total && last.records.length ? pages.length + 1 : undefined,
    enabled: eligible,
  });
  const clubs = clubsQuery.data?.pages.flatMap((page) => page.records) ?? [];
  const searchClubs = () => {
    if (busyRef.current) {
      return;
    }
    setSelectedId(null);
    setKeyword(search.trim());
  };
  const runAction = async (action: "submit" | "cancel") => {
    if (!token || !user?.id || busyRef.current || stateQuery.isFetching || !stateQuery.isSuccess) {
      return;
    }
    const accountId = user.id;
    if (action === "submit" && (!eligible || selectedId == null)) {
      return;
    }
    if (action === "cancel" && (!pending || !stateQuery.data?.id)) {
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      if (action === "submit" && selectedId != null) {
        await submitClubJoin(token, selectedId);
      } else if (action === "cancel" && stateQuery.data?.id) {
        await cancelClubJoin(token, stateQuery.data.id);
      }
      if (useAuthStore.getState().accessToken !== token || useAuthStore.getState().user?.id !== accountId) {
        return;
      }
      setSelectedId(null);
      showToast(action === "submit" ? "申请已提交，请等待审核" : "申请已取消");
      await queryClient.invalidateQueries({ queryKey: clubJoinStateKey(token) });
    } catch (error) {
      if (useAuthStore.getState().accessToken === token && useAuthStore.getState().user?.id === accountId) {
        showToast(error instanceof Error ? error.message : "操作失败，请稍后重试");
        await queryClient.invalidateQueries({ queryKey: clubJoinStateKey(token) });
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const submit = () => { runAction("submit"); };
  const cancel = () => { runAction("cancel"); };
  const loadMore = () => {
    if (clubsQuery.hasNextPage && !clubsQuery.isFetchingNextPage) {
      clubsQuery.fetchNextPage();
    }
  };
  const back = () => {
    if (!busyRef.current) {
      router.back();
    }
  };
  const realName = () => router.push("/real-name-verification");

  return (
    <View style={styles.screen}>
      <ScreenHeader title="加入俱乐部" onBack={back} backIcon={backIcon} style={{ paddingTop: insets.top, height: insets.top + 44 }} />
      {!token || !user ? (
        <Text style={styles.notice}>请先登录</Text>
      ) : stateQuery.isPending || stateQuery.isFetching ? (
        <ActivityIndicator style={styles.loading} color="#FE1F4C" />
      ) : stateQuery.isError ? (
        <View style={styles.center}><Text style={styles.notice}>申请状态加载失败</Text><Pressable onPress={() => refetch()}><Text style={styles.link}>点击重试</Text></Pressable></View>
      ) : user.clubInfo?.id ? (
        <Text style={styles.notice}>您已加入俱乐部</Text>
      ) : approved ? (
        <View style={styles.card}>
          <Text style={styles.title}>申请已通过</Text>
          <Text style={styles.description}>正在同步俱乐部信息，请稍后返回个人主页查看。</Text>
        </View>
      ) : pending ? (
        <View style={styles.card}>
          <Text style={styles.title}>申请待审核</Text>
          <Text style={styles.description}>申请加入 {stateQuery.data?.clubName} 俱乐部，正在审核中</Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={cancel} style={[styles.outlineButton, busy && styles.disabled]}><Text style={styles.outlineText}>{busy ? "取消中…" : "取消申请"}</Text></Pressable>
        </View>
      ) : user.isRealName !== 1 ? (
        <View style={styles.card}>
          <Text style={styles.title}>加入俱乐部需要先完成实名认证</Text>
          <Text style={styles.description}>完成实名认证后，即可选择俱乐部提交申请。</Text>
          <Pressable accessibilityRole="button" onPress={realName} style={styles.primaryButton}><Text style={styles.primaryText}>去实名</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={styles.searchRow}>
            <TextInput accessibilityLabel="搜索俱乐部" value={search} onChangeText={setSearch} onSubmitEditing={searchClubs} editable={!busy} placeholder="请输入俱乐部名称" maxLength={50} returnKeyType="search" style={styles.input} />
            <Pressable accessibilityRole="button" onPress={searchClubs} style={styles.searchButton}><Text style={styles.link}>搜索</Text></Pressable>
          </View>
          {stateQuery.data?.status === "REJECTED" ? <Text style={styles.rejected}>上次申请被拒绝，可重新提交申请</Text> : null}
          <FlatList
            data={clubs}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: selectedId === item.id }} disabled={busy} onPress={() => setSelectedId(item.id)} style={styles.clubRow}>
                <Text style={styles.clubName}>{item.clubName || "未命名俱乐部"}</Text>
                <View style={[styles.radio, selectedId === item.id && styles.radioSelected]}>{selectedId === item.id ? <View style={styles.radioDot} /> : null}</View>
              </Pressable>
            )}
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={clubsQuery.isPending ? <ActivityIndicator style={styles.loading} color="#FE1F4C" /> : clubsQuery.isError ? <Pressable onPress={() => clubsQuery.refetch()}><Text style={styles.notice}>俱乐部加载失败，点击重试</Text></Pressable> : <Text style={styles.notice}>暂无可加入的俱乐部</Text>}
            ListFooterComponent={clubsQuery.isFetchingNextPage ? <ActivityIndicator color="#FE1F4C" /> : clubsQuery.isFetchNextPageError ? <Pressable onPress={loadMore}><Text style={styles.notice}>加载失败，点击重试</Text></Pressable> : null}
          />
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: selectedId == null || busy, busy }} disabled={selectedId == null || busy} onPress={submit} style={[styles.primaryButton, (selectedId == null || busy) && styles.disabled]}><Text style={styles.primaryText}>{busy ? "提交中…" : "提交申请"}</Text></Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  loading: { marginTop: 32 },
  center: { alignItems: "center", gap: 10 },
  notice: { color: "#979799", fontSize: 14, textAlign: "center", marginTop: 32 },
  card: { margin: 16, padding: 20, borderRadius: 12, backgroundColor: "#FFFFFF", gap: 16 },
  title: { color: "#0D0D0F", fontSize: 16, fontWeight: "600" },
  description: { color: "#656566", fontSize: 14, lineHeight: 22 },
  primaryButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "#FE1F4C" },
  primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  outlineButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: "#FE1F4C" },
  outlineText: { color: "#FE1F4C", fontSize: 14, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  searchRow: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: "#FFFFFF" },
  input: { flex: 1, height: 40, borderRadius: 8, backgroundColor: "#F5F6F7", paddingHorizontal: 12, color: "#0D0D0F" },
  searchButton: { justifyContent: "center", paddingHorizontal: 8 },
  link: { color: "#FE1F4C", fontSize: 14 },
  rejected: { color: "#FE1F4C", fontSize: 13, paddingHorizontal: 16, paddingTop: 12 },
  clubRow: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EEEEEE" },
  clubName: { flex: 1, color: "#0D0D0F", fontSize: 14 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: "#CCCCCC", alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: "#FE1F4C" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FE1F4C" },
  footer: { paddingHorizontal: 16, paddingTop: 8, backgroundColor: "#FFFFFF" },
});
