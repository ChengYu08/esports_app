# 首页 Tab 第一批 P0 优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除首页顶部频道（首页/大神/排行榜/小法庭）在 Android 低端机上的三类 P0 卡顿源：小法庭滚动时全屏重渲染、频道切换整屏重挂载、投票后整列表重置。

**Architecture:** 三个独立小改动，全部保持现有业务行为不变：(1) 小法庭 `onScroll` 用 React 同值豁免跳过无意义 setState；(2) 首页顶部频道改为"懒挂载 + 常驻 + display:none 显隐"（小法庭因含 useFocusEffect 聚焦加载逻辑，保持原条件渲染不变）；(3) 投票成功后改为本地更新单条案件（服务端票数优先、缺省乐观 +1），不再整列表重拉。

**Tech Stack:** Expo SDK 57 / RN 0.86 (Fabric) / React Query（本批不新增依赖）。

**Spec:** 本次会话的性能优化报告"第一批 P0 1-3"。核心约束：**不影响业务逻辑**——所有用户可见行为（数据、文案、交互结果）保持一致，只改执行时机与渲染路径。

## Global Constraints

- 不主动 commit：所有改动留在工作区（项目规则优先，跳过 superpowers 流程自带的 commit 步骤）
- 注释用中文；不用 `void fn(){}` 写法；`if` 必须带大括号块；事件回调传函数引用而非调用表达式
- 验证命令：`npx tsc --noEmit`、`npx vitest run`
- 只改 JS/TS，不动原生/依赖/配置；装包验证可复用 Metro dev build（`npm run android`）

---

### Task 1: 小法庭 onScroll 同值豁免

**Files:**
- Modify: `src/features/court/screens/CourtHomeScreen.tsx:480-484`

**Interfaces:**
- Consumes: 现有 `backToTopFeed` state（string | null）与 `feedKey`
- Produces: 行为不变，仅滚动期间不再每次事件都触发重渲染

- [ ] **Step 1: 修改 onScroll 处理**

将：

```tsx
onScroll={(event) => {
  setBackToTopFeed(
    event.nativeEvent.contentOffset.y > 80 ? feedKey : null,
  );
}}
```

改为：

```tsx
onScroll={(event) => {
  // 滚动中绝大多数事件与当前状态相同，React 对同值 setState 直接豁免，避免低端机滚动时全屏重渲染。
  const beyond = event.nativeEvent.contentOffset.y > 80;
  const next = beyond ? feedKey : null;
  setBackToTopFeed((prev) => (prev === next ? prev : next));
}}
```

说明：功能更新式 setState 在计算结果与 prev 相同时 React 会跳过重渲染，最终状态与原实现完全一致（含 feedKey 切换、聚焦重置 `setBackToTopFeed(null)` 等所有路径），只是把"每次滚动事件都重渲染"降为"跨越 80px 阈值各一次"。

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 2: 首页顶部频道懒挂载 + 常驻（keep-alive）

**Files:**
- Modify: `src/features/home/screens/HomeScreen.tsx`（state 定义约 :35-44、selectTopTab 约 :122-124、scrollY 重置 effect 约 :187-189、渲染块约 :199-262、styles 约 :267-284）

**Interfaces:**
- Consumes: 现有 `HomeTab` 类型、`topTab` state、各频道屏幕组件（签名不变）
- Produces: `mountedTabs` state（`Record<HomeTab, boolean>`）；`CourtHomeScreen` 保持条件渲染（其 useFocusEffect 聚焦加载逻辑依赖挂载时机，保持原样即行为不变）

设计要点：
- **懒挂载**：频道首次被选中才挂载（`selectTopTab` 里同时更新 `mountedTabs`），保证查询首次发起时机与现在完全一致（不在启动时提前发大神/排行榜请求）
- **常驻**：挂载后不再卸载，用 `display: "none"` 隐藏；RN 0.86 仅 Fabric，`display: none` 不销毁原生视图，滚动位置保留
- **小法庭保持条件渲染**：CourtHomeScreen 的 `useFocusEffect` 按当前逻辑依赖"挂载 + 聚焦"，常驻会让它在隐藏时也后台重拉数据，属于业务行为变化，不做

- [ ] **Step 1: 增加 mountedTabs state 并修改 selectTopTab**

在 `const [topTab, setTopTab] = useState<HomeTab>("home");` 之后增加：

```tsx
// 顶部频道懒挂载 + 常驻：首次选中才挂载，之后仅显隐切换，避免低端机反复整屏重挂载。
const [mountedTabs, setMountedTabs] = useState<Record<HomeTab, boolean>>({
  home: true,
  god: false,
  ranking: false,
  court: false,
});
```

将：

```tsx
const selectTopTab = useCallback((tab: HomeTab) => {
  setTopTab(tab);
}, []);
```

改为：

```tsx
const selectTopTab = useCallback((tab: HomeTab) => {
  setTopTab(tab);
  setMountedTabs((current) =>
    current[tab] ? current : { ...current, [tab]: true },
  );
}, []);
```

- [ ] **Step 2: 调整 scrollY 重置 effect**

将：

```tsx
// 切换顶部频道或重新挂载列表时，背景回到首屏状态。
useEffect(() => {
  scrollY.setValue(0);
}, [topTab, isHomeLoading, scrollY]);
```

改为：

```tsx
// 列表首次加载完成时背景回到首屏状态；频道切换后 keep-alive 保住滚动位置，背景透明度跟随真实偏移。
useEffect(() => {
  scrollY.setValue(0);
}, [isHomeLoading, scrollY]);
```

（去掉 `topTab` 依赖：频道切换不再强制背景归零，否则会与恢复的滚动位置不一致。）

- [ ] **Step 3: 重构渲染块**

将 `return (...)` 中 `<HomeTopBar ... />` 之后的整段条件渲染（`{isHomeLoading && topTab === "home" ? (...) : topTab === "god" ? (...) : ... }`）替换为：

```tsx
<View style={styles.paneContainer}>
  {mountedTabs.home && (
    <View style={[styles.pane, topTab !== "home" && styles.paneHidden]}>
      {isHomeLoading ? (
        <HomeSkeleton bottomPadding={100 + insets.bottom} />
      ) : (
        <Animated.FlatList
          style={styles.clubList}
          data={clubItems}
          keyExtractor={(item) => item.id}
          renderItem={renderClub}
          ListHeaderComponent={header}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: 100 + insets.bottom,
          }}
          refreshControl={
            <RefreshControl
              refreshing={
                (clubs.isRefetching && !clubs.isFetchingNextPage) ||
                games.isRefetching ||
                categories.isRefetching ||
                banners.isRefetching
              }
              onRefresh={refreshHome}
              tintColor="#ff214b"
            />
          }
          onEndReached={loadMoreClubs}
          onEndReachedThreshold={0.3}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={
            clubs.isLoading ? (
              <LoadingState />
            ) : clubs.isError ? (
              <ErrorState onRetry={clubs.refetch} />
            ) : (
              <EmptyState message="暂无俱乐部" />
            )
          }
        />
      )}
    </View>
  )}
  {mountedTabs.god && (
    <View style={[styles.pane, topTab !== "god" && styles.paneHidden]}>
      <GodListScreen />
    </View>
  )}
  {mountedTabs.ranking && (
    <View style={[styles.pane, topTab !== "ranking" && styles.paneHidden]}>
      <RankingScreen embedded />
    </View>
  )}
  {topTab === "court" && (
    <CourtHomeScreen
      key={courtEntry}
      bottomInset={insets.bottom}
      initialPage={courtInitialPage}
    />
  )}
</View>
```

注意：FlatList 的所有 props 保持与原实现逐字一致（上面已完整给出，不要增删）。

- [ ] **Step 4: 增加样式**

在 `styles` 中（`emptyCourt` 之前）增加：

```tsx
paneContainer: { flex: 1 },
pane: { flex: 1 },
paneHidden: { display: "none" },
```

- [ ] **Step 5: 类型检查 + 全量单测**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors，测试全部通过（已知失败项仅 `client-auth.contract` 注销用例，为 test 分支原版问题）

- [ ] **Step 6: 风险点记录（若真机验证失败时的回退）**

若真机验证发现隐藏 pane 恢复后滚动位置丢失或出现空白：把出问题的那个 pane 的 `styles.paneHidden` 用法改回条件渲染（`{topTab === "xxx" && ...}`），等价于对该项单独回退，不影响其余 pane。

---

### Task 3: 投票后本地更新，去掉整列表重拉（TDD）

**Files:**
- Modify: `src/features/court/court-vote.ts`（`submitCourtVote` 返回票数；新增纯函数 `applyVoteToCases`）
- Test: `src/features/court/court-vote.test.ts`（追加用例）
- Modify: `src/features/court/screens/CourtHomeScreen.tsx`（`vote()` 内，约 :226-251）

**Interfaces:**
- Consumes: `courtApi.vote` 已有返回类型 `{ plaintiffVoteCount?: number; defendantVoteCount?: number }`；`CourtCase.voteSummary` 为 `{ plaintiff?: number; defendant?: number }`
- Produces: `applyVoteToCases(cases: CourtCase[], caseId: string | number, result: "PLAINTIFF_WIN" | "DEFENDANT_WIN", counts?: { plaintiffVoteCount?: number; defendantVoteCount?: number } | null): CourtCase[]`；`submitCourtVote` 成功返回值新增字段 `voteCounts`（原有字段不变，对现有调用方向后兼容）

- [ ] **Step 1: 写失败测试**

在 `court-vote.test.ts` 的 import 中加入 `applyVoteToCases`，并在文件末尾追加：

```ts
describe("applyVoteToCases", () => {
  const voted = {
    caseId: 42,
    stage: "VOTING",
    voteSummary: { plaintiff: 3, defendant: 5 },
  } as CourtCase;

  it("updates only the voted case with server counts and keeps other rows by reference", () => {
    const other = { caseId: 7, stage: "VOTING" } as CourtCase;
    const rows = applyVoteToCases(
      [other, voted],
      42,
      "PLAINTIFF_WIN",
      { plaintiffVoteCount: 4, defendantVoteCount: 5 },
    );
    expect(rows[0]).toBe(other);
    expect(rows[1].myVoteResult).toBe("PLAINTIFF_WIN");
    expect(rows[1].voteSummary).toEqual({ plaintiff: 4, defendant: 5 });
  });

  it("falls back to optimistic increment when the server omits counts", () => {
    const rows = applyVoteToCases([voted], "42", "DEFENDANT_WIN", undefined);
    expect(rows[0].myVoteResult).toBe("DEFENDANT_WIN");
    expect(rows[0].voteSummary).toEqual({ plaintiff: 3, defendant: 6 });
  });

  it("handles a case without a previous summary and null counts", () => {
    const rows = applyVoteToCases(
      [{ caseId: 1, stage: "VOTING" } as CourtCase],
      1,
      "PLAINTIFF_WIN",
      null,
    );
    expect(rows[0].voteSummary).toEqual({ plaintiff: 1, defendant: 0 });
  });
});
```

同时在 `describe("App voting and reviewer certification", ...)` 内追加一个用例（放在 `refreshes qualification...` 用例之后）：

```ts
  it("returns the server vote counts for local list updates", async () => {
    vi.mocked(courtApi.vote).mockResolvedValue({
      plaintiffVoteCount: 9,
      defendantVoteCount: 2,
    });
    expect(await submitCourtVote(activeCase, "PLAINTIFF_WIN")).toEqual({
      type: "voted",
      reviewerStatus: { pageStatus: "APPROVED" },
      voteCounts: { plaintiffVoteCount: 9, defendantVoteCount: 2 },
    });
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/features/court/court-vote.test.ts`
Expected: FAIL（`applyVoteToCases` 未导出；`voteCounts` 断言失败）

- [ ] **Step 3: 实现 court-vote.ts 改动**

`submitCourtVote` 末尾将：

```ts
  await courtApi.vote(latest.caseId, latest.level || "FIRST", side);
  return { type: "voted" as const, reviewerStatus };
```

改为：

```ts
  const voteCounts = await courtApi.vote(
    latest.caseId,
    latest.level || "FIRST",
    side,
  );
  return { type: "voted" as const, reviewerStatus, voteCounts };
```

在文件末尾（`submitCourtVote` 之后）新增：

```ts
/** 投票成功后的本地列表更新：优先采用服务端返回的最新票数，缺省时对所投一侧乐观 +1。 */
export function applyVoteToCases(
  cases: CourtCase[],
  caseId: string | number,
  result: "PLAINTIFF_WIN" | "DEFENDANT_WIN",
  counts?: { plaintiffVoteCount?: number; defendantVoteCount?: number } | null,
): CourtCase[] {
  return cases.map((row) => {
    if (String(row.caseId) !== String(caseId)) {
      return row;
    }
    const summary = row.voteSummary ?? {};
    return {
      ...row,
      myVoteResult: result,
      voteSummary: {
        plaintiff:
          counts?.plaintiffVoteCount ??
          (summary.plaintiff ?? 0) + (result === "PLAINTIFF_WIN" ? 1 : 0),
        defendant:
          counts?.defendantVoteCount ??
          (summary.defendant ?? 0) + (result === "DEFENDANT_WIN" ? 1 : 0),
      },
    };
  });
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/features/court/court-vote.test.ts`
Expected: PASS（含原有全部用例）

- [ ] **Step 5: 修改 CourtHomeScreen 的 vote()**

import 处将：

```tsx
import {
  isCourtReviewerApproved,
  submitCourtVote,
} from "@/features/court/court-vote";
```

改为：

```tsx
import {
  applyVoteToCases,
  isCourtReviewerApproved,
  submitCourtVote,
} from "@/features/court/court-vote";
```

`vote()` 中将：

```tsx
      setCases((current) =>
        current.map((row) =>
          String(row.caseId) === String(item.caseId)
            ? { ...row, myVoteResult: result }
            : row,
        ),
      );
      showToast("支持成功");
      await load();
```

改为：

```tsx
      setCases((current) =>
        applyVoteToCases(current, item.caseId, result, outcome.voteCounts),
      );
      showToast("支持成功");
```

说明：`myVoteResult` 与票数立即生效（与重拉后的服务端显示一致）；不再丢弃已加载的多页数据、不再全屏 loading、不再回顶。`load` 函数本身保留（聚焦刷新仍在用）。

- [ ] **Step 6: 类型检查 + 全量单测**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors；除已知原版失败项外全部通过

---

### Task 4: 整体验证（人工/真机）

**Files:** 无代码改动

- [ ] **Step 1: lint 涉及文件**

Run: `npx expo lint`
Expected: 无新增告警（存量告警不处理）

- [ ] **Step 2: 真机验证（dev build，Metro 连测试环境）**

Run: `npm run android`（注意 JAVA_HOME 指向 jdk-17；不加 `--device`）

验证清单（全部通过才算完成）：
1. 首页频道 → 大神 → 首页：俱乐部列表滚动位置保留，无整屏 loading、无闪烁
2. 大神 ↔ 排行榜 ↔ 首页 反复快速切换：无明显卡顿，数据不重复请求（首次进入后）
3. 首页频道下拉刷新、上滑加载更多正常；顶部背景渐变随滚动正常出现/消失
4. 小法庭频道滚动：>80px 出现"回到顶部"、回到顶部附近按钮消失（与原行为一致）
5. 小法庭投票成功：提示"支持成功"、所投一侧票数 +1（或服务端票数）、列表不回顶、已加载页数保留、卡片变为已投状态（不可重复投票）
6. 小法庭下拉刷新 / 切换"全部/最新/收藏/我的" / 切换"小法庭/平台工单"：与改动前一致（列表重置、重新加载）
7. 认证引导弹窗、收藏切换（含收藏频道内取消收藏移除卡片）行为不变
8. 首次冷启动：不会提前发出大神列表 / 排行榜请求（进入对应频道才请求）

- [ ] **Step 3: 汇报结果**

向用户汇报每项验证结果；如有失败项按 Task 2 Step 6 的回退方案处理后再验证。
