# 公共页头 ScreenHeader 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 抽取公共 `ScreenHeader` 组件统一全 App 页面级页头，修复 6 个页面标题右偏 16px 的问题，并杜绝后续手抄页头再次出现左右不对称。

**Architecture:** 标题改为绝对定位居中（`pointerEvents="none"` 的浮层 View），左右两侧返回按钮/右插槽走正常 flex 布局——两侧宽度无论差多少，标题永远精确居中。各页面删除手写的 `[返回][标题][右占位]` 三段式行，只保留页面自身的标题字体样式通过 `titleStyle` 传入，布局全部收口到组件内。

**Tech Stack:** React Native 0.86 StyleSheet、expo-image（svg 返回图标）、@fluentui/react-native-icons（默认返回箭头）。

**Spec:** 本会话与用户确认的方案（对话记录 2026-10-31）：彻底方案 = 抽公共组件 + 全量替换。

## Global Constraints

- **禁止主动 commit**：项目 skill 规定用户没要求就只留工作区；本计划所有任务不包含 commit 步骤。
- 每个任务完成后必须 `npx tsc --noEmit` 通过、`npx eslint <涉及文件>` 无 error。
- 组件放 `src/shared/ui/ScreenHeader.tsx`（无业务语义纯 UI，符合项目 skill 的提升规则）。
- 返回图标默认用 `@fluentui/react-native-icons` 的 `ChevronLeft24Regular`（项目 skill 规定优先复用现有图标库）；个别页面原用 svg 图标的通过 `backIcon` prop 传入保持视觉不变。
- 视觉零回归是硬红线：各页面标题的字号/字重/字体/颜色保持原样（通过 `titleStyle` 传页面原样式），只统一布局。
- 注释一律中文；`onPress={fn}` 标准写法；不用 `if (x) return;` 单行写法。
- BottomSheet 内的标题行（`BirthDatePickerSheet`、`ClubQuickMatchSheet`）**不在本计划范围**：它们用 `flex:1 + textAlign:"center"` 本来就居中，无偏移问题。

## 背景：根因与受影响页面

页头行布局 `flexDirection:"row" + justifyContent:"space-between"`，子元素 `[返回按钮][标题][右占位]`。标题居中的前提是左右宽度相等；不相等时标题中心偏移 = (左宽 − 右宽) ÷ 2。实测：

| 偏移 16px 的页面（back 48 / spacer 16） | 正常页面（左右配对） |
|---|---|
| BasicSettingsScreen 基础设置 | AboutScreen 32/32 |
| AccountSecurityScreen 账号与安全 | AccountSettingsScreen 28/28 |
| AccountCancellationScreen 注销 | BlacklistScreen 28/28 |
| MessageNotificationScreen 消息通知 | EditProfileScreen 44/44 |
| RealNameVerificationScreen 实名认证 | ProfileRelationScreen 48/48 |
| TeenModeScreen 青少年模式 | ProtocolScreen 28/28、ReportScreen 28/28 |

---

### Task 1: 创建 ScreenHeader 组件

**Files:**
- Create: `src/shared/ui/ScreenHeader.tsx`

**Interfaces:**
- Produces（后续所有任务消费）:

```ts
type ScreenHeaderProps = {
  title: string;
  onBack?: () => void;              // 不传则左侧只占位不渲染按钮
  backIcon?: number;                // 自定义返回图标（require 的 svg），缺省 ChevronLeft24Regular
  backIconColor?: string;           // 缺省 "#0A0A0A"
  right?: React.ReactNode;          // 右侧插槽（保存按钮/占位等）
  backgroundColor?: string;         // 缺省 "#FFFFFF"
  height?: number;                  // 缺省 44
  titleStyle?: StyleProp<TextStyle>; // 页面原有标题样式（字体/字号/字重/颜色）
  style?: StyleProp<ViewStyle>;     // 容器附加样式（如 paddingTop: insets.top）
};
export function ScreenHeader(props: ScreenHeaderProps): JSX.Element;
```

纯展示组件、无可单测的逻辑分支（项目无 RN 组件测试基建，不新增测试依赖），验证手段为 tsc + lint + Task 5 的真机视觉检查。

- [ ] **Step 1: 写组件**

```tsx
import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { Image, type ImageSource } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode, StyleProp, TextStyle, ViewStyle } from "react-native";

type ScreenHeaderProps = {
  title: string;
  onBack?: () => void;
  backIcon?: ImageSource;
  backIconColor?: string;
  right?: ReactNode;
  backgroundColor?: string;
  height?: number;
  titleStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
};

const BACK_BUTTON_WIDTH = 48;

// 公共页头：标题绝对定位居中，左右两侧宽度不对称也不影响居中；
// 浮层 View 设 pointerEvents="none"，不遮挡两侧按钮的点击。
export function ScreenHeader({
  title,
  onBack,
  backIcon,
  backIconColor,
  right,
  backgroundColor = "#FFFFFF",
  height = 44,
  titleStyle,
  style,
}: ScreenHeaderProps) {
  const iconColor = backIconColor ?? "#0A0A0A";
  return (
    <View
      style={[
        styles.header,
        { backgroundColor, height },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="返回"
        disabled={!onBack}
        hitSlop={8}
        onPress={onBack}
        style={[styles.back, !onBack && styles.backPlaceholder]}
      >
        {backIcon ? (
          <Image
            source={backIcon}
            style={[styles.backIcon, iconColor ? { tintColor: iconColor } : null]}
          />
        ) : (
          <ChevronLeft24Regular color={iconColor} width={24} height={24} />
        )}
      </Pressable>
      <View style={styles.right}>{right}</View>
      <View pointerEvents="none" style={styles.titleWrap}>
        <Text numberOfLines={1} style={[styles.title, titleStyle]}>
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  back: {
    width: BACK_BUTTON_WIDTH,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  backPlaceholder: {
    opacity: 0,
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  right: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  titleWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: BACK_BUTTON_WIDTH,
  },
  title: {
    color: "#0A0A0A",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
    textAlign: "center",
  },
});
```

注意：RN 0.86 类型下 `StyleSheet.absoluteFillObject` 可能不可用（本项目此前踩过），若 tsc 报错，用显式 `position: "absolute", left: 0, right: 0, top: 0, bottom: 0` 替换 titleWrap 里的展开。

- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit && npx eslint src/shared/ui/ScreenHeader.tsx`
Expected: 均通过。

---

### Task 2: 迁移 6 个标题偏移的页面（本次 bug 的直接修复）

**Files:**
- Modify: `src/features/mine/screens/BasicSettingsScreen.tsx:159-175`
- Modify: `src/features/mine/screens/AccountSecurityScreen.tsx`（页头 JSX 段）
- Modify: `src/features/mine/screens/AccountCancellationScreen.tsx`（页头 JSX 段）
- Modify: `src/features/mine/screens/MessageNotificationScreen.tsx`（页头 JSX 段）
- Modify: `src/features/mine/screens/RealNameVerificationScreen.tsx`（页头 JSX 段，标题样式名是 `styles.title`）
- Modify: `src/features/mine/screens/TeenModeScreen.tsx`（页头 JSX 段）

**Interfaces:**
- Consumes: Task 1 的 `ScreenHeader`。

**统一迁移规则（6 个文件全部适用）：**
1. 先 Read 目标文件，定位 `[返回 Pressable][标题 Text][右占位 View]` 三段式 JSX。
2. 用下面模板替换整段页头 JSX（按页面实际值填 `title` 文案、返回图标、`titleStyle`、insets 处理）：

```tsx
<ScreenHeader
  title="基础设置"
  onBack={() => router.back()}
  titleStyle={styles.headerTitle}
  style={BasicSettingsScreen 特例：{ paddingTop: insets.top, height: insets.top + 44 }}
/>
```

3. 页面原 `headerTitle` 样式**保留**（只删布局类样式：`header`、`backButton`、`backIcon`、`headerEnd`、`headerSpace` 等页头专用项，删前确认无其他引用）。
4. 返回图标处理：原页面用 `require(...)` 的 svg 返回图标 → 传 `backIcon={backIcon}`；原来用 `ChevronLeft24Regular` → 不传（用组件默认）；原页面无 insets 特殊处理的，外层结构（SafeAreaView 等）不动。
5. 组件 import 加到该文件 import 区。

各页面参数速查（文案已核实，其余以文件实际内容为准）：

| 文件 | title | titleStyle | 返回图标 | 特殊处理 |
|---|---|---|---|---|
| BasicSettingsScreen | 基础设置 | styles.headerTitle（无 fontFamily，500/16） | svg backIcon | header 带 `paddingTop: insets.top, height: insets.top + 44`，原 header 无左右 padding |
| AccountSecurityScreen | 账号与安全 | 页面原 title 样式 | 以文件为准 | 无 |
| AccountCancellationScreen | 以文件为准 | 以文件为准 | 以文件为准 | 无 |
| MessageNotificationScreen | 消息通知 | styles.headerTitle（同 BasicSettings 风格） | 以文件为准 | 无 |
| RealNameVerificationScreen | 实名认证 | styles.title | 以文件为准 | 无 |
| TeenModeScreen | 青少年模式（以文件为准） | 以文件为准 | 以文件为准 | 无 |

- [ ] **Step 1: 逐文件按上面规则迁移（先 Read 再 Edit）**
- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit && npx eslint <6 个文件>`
Expected: 通过；`grep -n "headerEnd\|headerSpace" <6 个文件>` 无残留。

---

### Task 3: 迁移 mine 域其余配对页头（收口，防再犯）

**Files:**
- Modify: `src/features/mine/screens/AboutScreen.tsx`（关于盼之电竞，32/32）
- Modify: `src/features/mine/screens/AccountSettingsScreen.tsx`（账号设置，28/28，header 有 `paddingHorizontal: 16` → 通过 `style` 传入）
- Modify: `src/features/mine/screens/BlacklistScreen.tsx`（黑名单，28/28，header 有 `paddingHorizontal: 16` + 底部 hairline 分隔线 → 分隔线移到 `style`）
- Modify: `src/features/mine/screens/EditProfileScreen.tsx`（编辑资料，44/44）
- Modify: `src/features/mine/screens/EditNicknameScreen.tsx`（编辑昵称，右侧有"保存"按钮 → `right` 插槽）
- Modify: `src/features/mine/screens/EditSignatureScreen.tsx`（编辑签名，右侧"保存"按钮 → `right` 插槽）
- Modify: `src/features/mine/screens/ProtocolScreen.tsx`（用户协议，28/28）
- Modify: `src/features/mine/screens/ReportScreen.tsx`（举报，28/28）
- Modify: `src/features/mine/screens/ProfileRelationScreen.tsx`（48/48）
- Modify: `src/features/mine/screens/StarRechargeScreen.tsx`（星钻充值，右侧 `headerSide` → `right` 插槽）
- Modify: `src/features/mine/screens/StarRechargeAndroidScreen.tsx`（安卓变体，同上）

**Interfaces:**
- Consumes: Task 1 的 `ScreenHeader`。

迁移规则与 Task 2 完全一致（先 Read 再 Edit；标题字体样式原样传 `titleStyle`；右占位/右侧按钮换成 `right` 插槽或省略；删除页头布局样式前确认无引用）。右侧有实际按钮（保存等）的页面模板：

```tsx
<ScreenHeader
  title="编辑昵称"
  onBack={() => router.back()}
  titleStyle={styles.headerTitle}
  right={
    <Pressable accessibilityRole="button" onPress={handleSave} style={styles.saveButton}>
      <Text style={styles.saveText}>保存</Text>
    </Pressable>
  }
/>
```

注意：右侧按钮原来紧贴屏幕右缘的（如无 `paddingHorizontal` 的页面），给 `right` 插槽内容保持原 margin，视觉不变。

- [ ] **Step 1: 逐文件迁移**
- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit && npx eslint <涉及文件>`
Expected: 通过。

---

### Task 4: 迁移 court / order / home 域页头（先核查再迁移）

**Files:**
- Modify: `src/features/court/screens/CourtDetailScreen.tsx`（评审详情；返回是文本"‹"→ 改用组件默认箭头会变视觉，保留原样需评估；header 用 `height: 44 + insets.top, paddingTop: insets.top` → `style` 传入）
- Modify: `src/features/court/screens/CourtComplaintScreen.tsx`（标题是动态 `{title}` 变量 → `title={title}`）
- Modify: `src/features/order/screens/DispatchDetailScreen.tsx`（派单详情；返回也是文本"‹"）
- Modify: `src/features/order/screens/OrderDetailScreen.tsx`（其"headerTitle"实为 32 宽占位、真实标题位置待核实——**先 Read 确认结构**：若标题不在页头行内则本文件跳过，只把两个 32 宽占位换成组件的无按钮占位形态或原样保留并在计划执行记录中注明）
- Modify: `src/features/home/screens/PriceListScreen.tsx`（价格表；结构待 Read 核实，匹配 `[返回][标题][右占位]` 模式才迁移）

**Interfaces:**
- Consumes: Task 1 的 `ScreenHeader`。

文本"‹"返回按钮的决策规则：若该页其余视觉均为设计稿还原且"‹"是有意为之 → 传 `backIcon` 不可用时改传自定义 `right`/整体保留原页头并记录跳过原因；若属于历史遗留 → 统一换成默认箭头（与全 App 一致）。倾向统一换默认箭头，但每个文件换之前对比该域其他页面返回图标风格，保持域内一致。

- [ ] **Step 1: 逐文件 Read 核实结构 → 按 Task 2 规则迁移或记录跳过原因**
- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit && npx eslint <涉及文件>`
Expected: 通过。

---

### Task 5: 收尾清理与真机验证

**Files:**
- Modify: 上述所有迁移文件（清理死样式）

**Interfaces:** 无新增。

- [ ] **Step 1: 全仓 grep 残留死样式**

Run: `grep -rn "headerEnd: {\|headerSpace: {\|headerSlot: {" src/ --include="*.tsx"`
Expected: 仅剩 Task 4 中记录跳过的文件；其余无残留。

- [ ] **Step 2: 全量静态验证**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc 通过；vitest 仅剩已知历史失败（client-auth.contract 注销 void 响应，test 分支原版问题）。

- [ ] **Step 3: 真机视觉验证（Metro 热载，无需重打 APK）**

设备 AWSKCP5216400450 已连、Metro 运行中。当前 App 是游客态，能看的页面：关于/协议/价格表（从可游客访问入口进入）；需登录的页面（基础设置/账号与安全/消息通知等）请用户登录后逐页核对：
1. 标题水平居中（对照屏幕中线，不再右偏 16px）；
2. 返回按钮可点击、图标与迁移前一致；
3. 保存按钮（编辑资料/昵称/签名）位置与迁移前一致；
4. 页头背景色、高度、insets 顶部间距与迁移前一致。

- [ ] **Step 4: 汇报**

向用户汇总：迁移文件清单、跳过文件及原因、验证结果，等待用户真机确认后按其指示提交。

## Self-Review 结论

- 覆盖：根因（左右不对称）由组件绝对定位居中根治；6 个偏移页面 + 全部同模式页面均有对应任务；sheet 类明确排除并写明理由。
- 占位符：Task 2/3/4 的"以文件为准"单元格是刻意的执行期读取点（迁移规则 + 模板代码完整），不是缺失内容；OrderDetail/PriceList 的结构不确定性已给出明确决策规则。
- 类型一致性：`ScreenHeaderProps` 各处引用与 Task 1 定义一致。
