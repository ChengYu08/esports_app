# 陪玩师卡片公共组件化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把大神列表的陪玩师卡片（GodCard，已按最新设计稿实现）抽取为 `src/shared/ui/CompanionCard.tsx` 公共组件，首页大神列表与俱乐部主页陪玩师列表共用，俱乐部数据补充新字段对齐展示。

**Architecture:** 按 AGENTS.md 跨 feature 复用规则，卡片提升为 `shared/ui` 无业务语义纯 UI 组件：展示与交互全部由 props 驱动（跳转、语音播放由父级注入）。`god.api.ts` 的 `GodListItem` 与 `home` 的 `Companion` 各自显式映射为卡片 props。俱乐部接口 `/client/v1/companion/public/page` 已实测返回与大神接口相同的新字段（tagName/tagMobileBackgroundColor/modeName/levelName/clubGameServiceName/gameName），扩展 `ApiCompanion`/`Companion` 映射即可。

**Tech Stack:** Expo SDK 57 + RN 0.86、expo-image、vitest（仅纯逻辑单测）。

**Spec:** 用户需求（2026-10-30 会话）：以大神陪玩师卡片为唯一基准抽取公共组件，大神与俱乐部主页两处复用，数据字段展示以大神卡片为准，注意数据兼容性。

## Global Constraints

- 卡片视觉与交互行为与 `GodListScreen` 当前 `GodCard` 逐像素一致（颜色、字号、行高、间距、字重均照搬，不改 tokens.ts——其现有色板与卡片色值不一致，收敛 tokens 属另一次重构，本计划保持字面量）。
- 注释用中文；不用 `void fn(){}` 写法；`if` 必须带花括号块；`onPress={fn}` 直接传函数。
- 不手改 android/ios 目录；不新增依赖。
- 跳转行为保持各页面现状：大神卡片跳 `/profile` 带 `clubId/userId/gameId`；俱乐部卡片跳 `/profile` 带 `clubId/userId`（展示按大神为准，导航是父级行为，本次不改变俱乐部跳转参数）。
- 语音播放按钮用 `VoicePlayButton tone="light"` + 大神卡片的 voicePill 样式（替换俱乐部旧的 `tone="pill"`）。

## Review Focus

- 俱乐部接口旧版本可能不返回新字段：所有新字段映射必须 `?? ""`/`?? null` 兜底，卡片对空 `tagName`/空 `gameName` 不渲染对应元素（由 Task 1 测试钉住）。
- `tagName` 有值但后台未下发颜色：卡片内部用 `levelTagColor` 色板兜底，两页面行为一致（卡片内实现，视觉走查）。
- 模式/等级/服务全空：第三行兜底 `signature`，再兜底「保持一点神秘感...」（卡片内实现，与大神列表现状一致）。
- 头像为空：兜底内置 `mine-avatar.png`，俱乐部旧卡的灰底占位不再出现（视觉走查）。
- 删除旧 `MemberCard`/`StatusTag` 后不得残留未使用的导入、样式与资源引用（tsc noUnusedLocals + expo lint 钉住）。

---

### Task 1: 扩展俱乐部陪玩数据字段（TDD）

**Files:**
- Test: `src/features/home/api/home.api.test.ts`
- Modify: `src/features/home/api/home.types.ts:91-104`（`Companion`）
- Modify: `src/features/home/api/home.api.ts:92`（`ApiCompanion`）、`home.api.ts:130-136`（`fetchCompanionPage` 映射）

**Interfaces:**
- Consumes: 现有 `fetchCompanionPage(filters, page, pageSize?, signal?)` 返回 `CompanionPage`。
- Produces: `Companion` 新增字段（与 `GodListItem` 同名同语义）：`tagName: string`、`tagColor: string`、`gameName: string`、`modeName: string`、`levelName: string`、`serviceName: string`、`age: number | null`；`signature` 保留。

- [ ] **Step 1: 写失败测试** —— 在 `home.api.test.ts` 新增 describe「俱乐部陪玩列表字段映射」，mock `apiClient` 返回含新字段与缺省字段的混合 records，断言：
  - `tagName/tagColor` 映射（`tagColor` 取 `tagMobileBackgroundColor`，缺失时回退 `tagBackgroundColor`，均无则为 `""`）；
  - `modeName/levelName` 直映、`serviceName` 取 `clubGameServiceName`、`gameName` 缺省为 `""`；
  - `age` 缺省为 `null`、有值时为 `Number`；
  - 旧字段（price/orderCount 等）映射不回归。

```ts
it("陪玩列表映射标签与模式/等级/服务字段，缺省时兜底空值", async () => {
  vi.mocked(apiClient).mockResolvedValue({
    code: "SUCCESS",
    data: { page: 1, totalPages: 1, records: [
      { profileId: 29, userId: 50100075, nickname: "哈吉蜂", sex: 1, age: 21,
        tagName: "明星", tagBackgroundColor: "#138666", tagMobileBackgroundColor: "#FE4267",
        gameName: "三角洲行动手游", modeName: "大乱斗", levelName: "星耀", clubGameServiceName: "陪玩",
        orderCount: 10, onlineStatus: 1, gameStatus: 1, price: 112 },
      { profileId: 68, nickname: "盼友", sex: 2, orderCount: 0 },
    ] },
  });
  const page = await fetchCompanionPage({ clubId: "1000006", gameId: "11" });
  expect(page.items[0]).toMatchObject({ tagName: "明星", tagColor: "#FE4267", gameName: "三角洲行动手游",
    modeName: "大乱斗", levelName: "星耀", serviceName: "陪玩", age: 21, price: 112 });
  expect(page.items[1]).toMatchObject({ tagName: "", tagColor: "", gameName: "", modeName: "",
    levelName: "", serviceName: "", age: null, signature: "", onlineStatus: 0 });
});
```

- [ ] **Step 2: 运行确认失败** —— `npx vitest run src/features/home/api/home.api.test.ts`，预期新用例 FAIL（字段 undefined）。

- [ ] **Step 3: 实现映射** —— `ApiCompanion` 补可选字段（tagId/tagName/tagIconUrl/tagBackgroundColor/tagMobileBackgroundColor/gameId/gameName/gameModeId/modeName/gameLevelId/levelName/clubGameServiceId/clubGameServiceName/companionServiceId/age）；`Companion` 补必填映射字段；`fetchCompanionPage` 映射写法与 `god.api.ts:123-133` 完全一致（`tagName: item.tagName || ""` 等，`age` 走 `!= null && !== ""` 判空）。

- [ ] **Step 4: 运行确认通过** —— 同 Step 2 命令，全部 PASS。

- [ ] **Step 5: 提交** —— `git add src/features/home/api/ && git commit -m "feat: 俱乐部陪玩列表接口补充标签与模式/等级/服务字段映射"`

### Task 2: 创建公共卡片组件 `shared/ui/CompanionCard`

**Files:**
- Create: `src/shared/ui/CompanionCard.tsx`

**Interfaces:**
- Consumes: `@/shared/audio/VoicePlayButton`（tone="light"）、`@/shared/audio/use-voice-player` 的类型约定（`playingUrl: string | null`、`onToggleVoice: (url: string) => void`）、既有切图资源（`assets/home/club-detail/male.svg`、`assets/mine/figma/mine-female.svg`、`assets/home/club-detail/icon-diamond.svg`、`assets/mine/figma/mine-avatar.png`、`assets/home/club-detail/status-playing.svg`、`assets/home/club-detail/status-idle.svg`，相对路径改为 `../../../assets/...`）。
- Produces: `export function CompanionCard(props: CompanionCardProps)`（`memo` 包裹导出），props 类型如下，供 Task 3/4 消费：

```ts
export type CompanionCardProps = {
  nickname: string;
  avatar: string;
  sex: number;
  age: number | null;
  tagName: string;
  tagColor: string;
  gameName?: string;
  gameIconUrl?: string;
  modeName?: string;
  levelName?: string;
  serviceName?: string;
  signature?: string;
  onlineStatus: number;
  gameStatus: number;
  price: number;
  orderCount: number;
  voiceUrl: string | null;
  voiceDurationSeconds: number | null;
  voicePlayingUrl: string | null;
  onToggleVoice: (voiceUrl: string) => void;
  onPress: () => void;
};
```

- [ ] **Step 1: 迁移实现** —— 把 `GodListScreen.tsx` 的 `GodCard`（含 `levelTagColor` 兜底色板、第三行 `introLine` 拼接兜底、全部相关样式与资源 require）原样搬到新文件，组件更名 `CompanionCard`，数据字段改读 props；`memo` 包裹（对齐俱乐部旧卡 memo 行为）。不引入路由/接口等业务依赖。RN 组件无既有组件测试基建，验证以 tsc + lint + 两页面接入后视觉走查为准（评审人可拒绝点：漏搬样式或改动了任何色值/尺寸）。

- [ ] **Step 2: 类型与静态检查** —— `npx tsc --noEmit` 通过（新文件暂无消费方，允许）。

- [ ] **Step 3: 提交** —— `git add src/shared/ui/CompanionCard.tsx && git commit -m "feat: 新增陪玩师公共卡片组件 CompanionCard（迁移自大神列表）"`

### Task 3: 大神列表接入公共组件

**Files:**
- Modify: `src/features/god/screens/GodListScreen.tsx`（`renderCard` 约 193-210 行、删除本地 `GodCard`/`levelTagColor` 及相关样式与资源 import）

**Interfaces:**
- Consumes: Task 2 的 `CompanionCard` / `CompanionCardProps`。
- Produces: 无（`GodListItem` 字段为 `CompanionCardProps` 的超集，`renderCard` 直接透传 + `gameIconUrl`）。

- [ ] **Step 1: 替换渲染** —— `renderCard` 改为渲染 `CompanionCard`（`item` 字段逐个透传、`gameIconUrl={gameIconByName.get(item.gameName)}`、语音与 onPress 原样）。
- [ ] **Step 2: 清理** —— 删除本地 `GodCard` 函数、`levelTagColor`、仅卡片使用的样式键与 `maleIcon/femaleIcon/diamondIcon/emptyAvatar/statusPlayingIcon/statusIdleIcon` 中不再被引用的 require（`arrowDown/arrowUpDown/allGames` 等仍被筛选栏使用，保留）。
- [ ] **Step 3: 验证** —— `npx tsc --noEmit` 通过；`npx expo lint 2>&1 | grep -c god` 为 0。
- [ ] **Step 4: 提交** —— `git commit -am "refactor: 大神列表改用公共陪玩师卡片组件"`

### Task 4: 俱乐部主页接入公共组件

**Files:**
- Modify: `src/features/home/screens/ClubDetailScreen.tsx`（`renderMember` 157-185 行、删除 `MemberCard` 828-940 行、`StatusTag` 777-797 行、`MemberStatus` 类型及相关样式；FlatList 约 390 行加 `ItemSeparatorComponent`）

**Interfaces:**
- Consumes: Task 1 的 `Companion` 新字段、Task 2 的 `CompanionCard`。

- [ ] **Step 1: 替换渲染** —— `renderMember` 改为渲染 `CompanionCard`，映射：`avatar: item.headImage ?? ""`、`sex: item.sex ?? 0`、`age: item.age ?? null`、`tagName/tagColor/modeName/levelName/serviceName` 直映、`gameName: item.gameName || selectedGameInfo?.name`、`gameIconUrl: selectedGameInfo?.iconUrl`（接口记录不带游戏图标，沿用所选游戏图标）、`voiceUrl: item.voiceUrl ?? null`、`voiceDurationSeconds: item.voiceDurationSeconds ?? null`、语音与 `onPress`（保持 `/profile` 只带 `clubId/userId`）原样。
- [ ] **Step 2: 分割线** —— FlatList 增加 `ItemSeparatorComponent`（`hairlineWidth` 高、`COLORS.border`、`marginHorizontal: 16`），替代原卡片内绝对定位 `memberDivider`。
- [ ] **Step 3: 清理** —— 删除 `MemberCard`、`StatusTag`、`MemberStatus`（确认无其他引用）及仅其使用的样式键（member*、statusTag* 等）与 `statusPlayingIcon/statusIdleIcon` 中失效的 require/导入。
- [ ] **Step 4: 验证** —— `npx tsc --noEmit` 通过；`npx expo lint 2>&1 | grep -c "home/screens/ClubDetail"` 为 0。
- [ ] **Step 5: 提交** —— `git commit -am "refactor: 俱乐部主页陪玩师列表改用公共卡片组件并对齐新字段展示"`

### Task 5: 全量校验收尾

- [ ] **Step 1:** `npx tsc --noEmit` 全仓通过。
- [ ] **Step 2:** `npx vitest run src/features/home/api/home.api.test.ts` 全部 PASS。
- [ ] **Step 3:** `npx expo lint` 无新增问题（god/home 相关文件 0 问题）。
- [ ] **Step 4:** 如有修复，补充提交；向用户汇报改动清单与自查结果（真机视觉走查由用户执行）。
