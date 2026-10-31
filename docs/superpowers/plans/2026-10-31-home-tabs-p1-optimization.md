# 首页 Tab 第二批 P1 优化实施计划（P1 4-6）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除大神列表 memo 失效、补齐三个长列表虚拟化参数、俱乐部卡片 memo 化，改善 Android 低端机快速滑动掉帧。

**Architecture:** 三个互相独立的小改动：(1) GodListScreen 抽出 memo 化 GodCard 中间层 + 稳定回调，使 `CompanionCard` 的 memo 真正生效；(2) 给首页俱乐部/大神/小法庭三个 FlatList 补 `windowSize`/`maxToRenderPerBatch`/`updateCellsBatchingPeriod`/`initialNumToRender`；(3) `ClubCard` 加 memo 并把 LinearGradient 角标提升为模块级共享元素。

**Tech Stack:** Expo SDK 57 / RN 0.86 (Fabric) / React Query（本批不新增依赖）。

**Spec:** 会话内 P1 报告第 4-6 条。核心约束：**不影响业务逻辑**——所有用户可见行为不变，只改渲染路径与列表虚拟化参数。

## Global Constraints

- 不主动 commit：所有改动留在工作区（项目规则，覆盖 superpowers 流程自带的 commit 步骤）
- 注释用中文；不用 `void fn(){}`；`if` 必须带大括号块；事件回调传函数引用
- 验证命令：`npx tsc --noEmit`、`npx vitest run`（已知原版失败项：`client-auth.contract` 注销用例）
- 只改 JS/TS，不动原生/依赖/配置
- 本批在工作区已有 P0 批次未提交改动（5 个文件），**严禁触碰或回退它们**；diff 验证按文件区分

---

### Task 1: 大神列表 memo 修复（P1-4）

**Files:**
- Modify: `src/features/god/screens/GodListScreen.tsx`

**Interfaces:**
- Consumes: `CompanionCard`（已是 memo，props 见 src/shared/ui/CompanionCard.tsx:14-38）；`useVoicePlayer()` 返回 `{ playingUrl, stop, toggle }`，`toggle`/`stop` 均为稳定 useCallback（src/shared/audio/use-voice-player.ts:9,17）；`levelTagColor(tagName)` 已在本文件 :139
- Produces: 本文件内部组件 `GodCard`（memo 化），无外部消费者

背景（现状问题）：`renderCard` 是组件体内联函数，每次父渲染重建所有可见 `CompanionCard` 的 props（`onPress` 闭包等），`CompanionCard` 的 memo 永远不命中；且 `voicePlayer.playingUrl`（屏幕级 state）任一变化也会全列表重渲染。打开筛选下拉（`openFilter` 变化）同样全列表重渲染。

- [ ] **Step 1: 修改 react import 与新增 GodCard 组件**

`import { useEffect, useMemo, useState } from "react";` 改为：

```tsx
import { memo, useCallback, useEffect, useMemo, useState } from "react";
```

在 `GodListScreen` 组件定义之前（`levelTagColor` 函数之后）新增：

```tsx
/**
 * 大神列表卡片中间层：隔离屏幕级 state（筛选、语音播放状态）变化，
 * 让 CompanionCard 的 memo 命中，仅重渲染播放状态实际变化的卡片。
 */
const GodCard = memo(function GodCard({
  item,
  gameIconUrl,
  playingUrl,
  onToggleVoice,
  onItemPress,
}: {
  item: GodListItem;
  gameIconUrl: string | undefined;
  playingUrl: string | null;
  onToggleVoice: (voiceUrl: string) => void;
  onItemPress: (item: GodListItem) => void;
}) {
  return (
    <CompanionCard
      nickname={item.nickname}
      avatar={item.avatar}
      sex={item.sex}
      age={item.age}
      introTagText={item.tagName}
      introTagColor={item.tagColor || levelTagColor(item.tagName)}
      gameName={item.gameName}
      gameIconUrl={gameIconUrl}
      modeName={item.modeName}
      levelName={item.levelName}
      serviceName={item.serviceName}
      signature={item.signature}
      onlineStatus={item.onlineStatus}
      gameStatus={item.gameStatus}
      price={item.price}
      orderCount={item.orderCount}
      voiceUrl={item.voiceUrl}
      voiceDurationSeconds={item.voiceDurationSeconds}
      voicePlayingUrl={playingUrl}
      onToggleVoice={onToggleVoice}
      onPress={() => onItemPress(item)}
    />
  );
});
```

- [ ] **Step 2: 替换 renderCard 为稳定回调**

在 `GodListScreen` 内、`const renderCard = ...` 处，将原内联 `renderCard`（从 `const renderCard = ({ item }: { item: GodListItem }) => (` 到对应闭合括号）替换为：

```tsx
const handleItemPress = useCallback(
  (item: GodListItem) => {
    router.push({
      pathname: "/profile",
      params: {
        clubId: String(item.clubId),
        userId: String(item.userId),
        ...(item.gameName
          ? { gameId: gameKey === ALL_GAME_KEY ? "" : gameKey }
          : {}),
      },
    });
  },
  [gameKey],
);

const renderCard = useCallback(
  ({ item }: { item: GodListItem }) => (
    <GodCard
      item={item}
      gameIconUrl={gameIconByName.get(item.gameName)}
      playingUrl={voicePlayer.playingUrl}
      onToggleVoice={voicePlayer.toggle}
      onItemPress={handleItemPress}
    />
  ),
  [
    gameIconByName,
    handleItemPress,
    voicePlayer.playingUrl,
    voicePlayer.toggle,
  ],
);
```

注意：跳转参数逻辑必须与原实现逐字等价（`gameKey === ALL_GAME_KEY ? "" : gameKey` 的条件展开保持不变）。

- [ ] **Step 3: 类型检查 + 单测**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors；除已知原版失败项外全部通过

---

### Task 2: 三个长列表补虚拟化参数（P1-5）

**Files:**
- Modify: `src/features/home/screens/HomeScreen.tsx`（首页俱乐部 Animated.FlatList，P0 批次改过的渲染块内）
- Modify: `src/features/god/screens/GodListScreen.tsx`（大神 FlatList）
- Modify: `src/features/court/screens/CourtHomeScreen.tsx`（小法庭 FlatList）

**Interfaces:**
- Consumes: 无
- Produces: 无（纯 props 增加）

参数选值说明：对齐排行榜既有实践（`windowSize={7} initialNumToRender={8}`）；卡片越重（小法庭 CourtCard 含多图多文本）批量越小。仅添加以下四个 props，不改动任何既有 props。

- [ ] **Step 1: 首页俱乐部列表**

在 `HomeScreen.tsx` 的俱乐部 `Animated.FlatList` 上（P0 批次重构后的渲染块，`onEndReachedThreshold={0.3}` 附近）添加：

```tsx
windowSize={7}
maxToRenderPerBatch={6}
updateCellsBatchingPeriod={50}
initialNumToRender={8}
```

- [ ] **Step 2: 大神列表**

在 `GodListScreen.tsx` 的 FlatList 上（`onEndReachedThreshold={0.2}` 附近）添加：

```tsx
windowSize={7}
maxToRenderPerBatch={6}
updateCellsBatchingPeriod={50}
initialNumToRender={6}
```

- [ ] **Step 3: 小法庭列表**

在 `CourtHomeScreen.tsx` 的 FlatList 上（`onEndReachedThreshold={0.4}` 附近）添加：

```tsx
windowSize={5}
maxToRenderPerBatch={4}
updateCellsBatchingPeriod={50}
initialNumToRender={6}
```

- [ ] **Step 4: 类型检查 + 单测**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors；除已知原版失败项外全部通过

---

### Task 3: 俱乐部卡片 memo + 渐变角标共享元素（P1-6）

**Files:**
- Modify: `src/features/home/components/ClubCard.tsx`

**Interfaces:**
- Consumes: 唯一调用方 `HomeScreen.tsx` 的 `renderClub`（已是 `useCallback([], ...)`，memo 可命中）
- Produces: `ClubCard` 导出名不变（`export const ClubCard = memo(...)`），调用方零改动

设计裁决（记入台账）：P1 报告中"角标渐变用预渲染 PNG 替代"需新增设计切图资产，本批不做；替代方案是把 `LinearGradient` 元素提升为模块级共享元素（React 元素是不可变描述符，多处复用安全），配合 memo 后渐变仅在卡片首挂载时创建，成本已降为一次性。PNG 替代留作后续（若真机度量仍显示瓶颈）。

- [ ] **Step 1: memo 化并提升渐变元素**

`import { Pressable, StyleSheet, Text, View } from "react-native";` 之后不需要新增 import（`memo` 需要从 react 导入：在文件头部按字母序加入 `import { memo } from "react";`）。

在 `const icons = {...};` 之后新增模块级常量：

```tsx
// 角标渐变为静态元素，提升到模块级共享，避免每张卡片渲染时重复创建。
const tagGradient = (
  <LinearGradient
    colors={["#FF8C6C", "#F92E7F"]}
    start={{ x: 0, y: 0.5 }}
    end={{ x: 1, y: 0.5 }}
    style={StyleSheet.absoluteFill}
  />
);
```

将：

```tsx
export function ClubCard({
  club,
  onSelect,
}: {
  club: Club;
  onSelect?: (club: Club) => void;
}) {
```

改为：

```tsx
export const ClubCard = memo(function ClubCard({
  club,
  onSelect,
}: {
  club: Club;
  onSelect?: (club: Club) => void;
}) {
```

函数体末尾对应的 `}` 需补 `)` 闭合 `memo(...)`。

卡片内角标处将：

```tsx
<LinearGradient
  colors={["#FF8C6C", "#F92E7F"]}
  start={{ x: 0, y: 0.5 }}
  end={{ x: 1, y: 0.5 }}
  style={StyleSheet.absoluteFill}
/>
```

替换为：

```tsx
{tagGradient}
```

- [ ] **Step 2: 类型检查 + 单测**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors；除已知原版失败项外全部通过

---

### Task 4: 验证

**Files:** 无代码改动

- [ ] **Step 1: lint**

Run: `npx expo lint`
Expected: 本次三个目标文件无新增告警（存量告警不动）

- [ ] **Step 2: 真机验证（dev build）**

Run: `npm run android`（JAVA_HOME 指向 jdk-17，不加 `--device`）

验证清单：
1. 大神列表快滑：掉帧明显改善；列表快速滑动无长时间空白区（windowSize 收窄的代价检查）
2. 大神列表：打开"性别/状态/价格"任一下拉筛选 → 弹层动画流畅，卡片不闪烁（memo 生效的间接证据）；选择筛选 → 列表正常刷新
3. 大神列表：点击任一语音播放 → 仅对应卡片的播放状态变化，其余卡片不重渲染（肉眼无闪烁）；再次点击停止
4. 大神列表：点击卡片 → 正常跳转 `/profile`，参数（clubId/userId/gameId 按"全部"与具体游戏两种情况）与改动前一致
5. 首页俱乐部列表快滑掉帧改善、加载更多正常；卡片角标渐变显示与改动前一致
6. 小法庭列表快滑掉帧改善；回到顶部按钮、加载更多正常
7. 三列表上滑到底部加载下一页时无卡顿异常（批量渲染参数调小的行为检查）
