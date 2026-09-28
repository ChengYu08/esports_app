# 消息 Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 Figma 节点 `13:8692` 实现当前 Expo 应用的消息 Tab 列表页面。

**Architecture:** 路由文件只负责挂载 `MessageScreen`，消息功能以展示模型、静态数据、列表项、顶部栏和页面容器组成独立模块。现有 `AppTabBar` 与系统状态栏继续负责底部导航和设备安全区，页面不重复绘制它们。

**Tech Stack:** Expo SDK 57、React Native 0.86、Expo Router、`expo-image`、TypeScript 6、React Native Safe Area Context

**Spec:** `docs/superpowers/specs/2026-09-28-message-tab-design.md`

## Global Constraints

- 页面背景为 `#F7F7F7`，顶部栏和列表为白色。
- 不绘制 Figma 模拟状态栏或底部导航栏。
- 所有新增图片资源保存到 `assets/message/` 且扩展名为 `.svg`。
- 不新增依赖，不创建或修改 `ios/`、`android/`。
- 不实现聊天详情、后端接口、实时通信或持久化。
- 所有按钮提供中文无障碍标签，图标操作区至少为 44×44。
- 完成前必须通过 `npm run lint` 和 `npx tsc --noEmit`。

---

### Task 1: 导出 Figma 消息页资源

**Files:**
- Create: `assets/message/message-back.svg`
- Create: `assets/message/message-clear.svg`
- Create: `assets/message/message-search.svg`
- Create: `assets/message/message-system.svg`
- Create: `assets/message/avatar-wangzhe.svg`
- Create: `assets/message/avatar-sorry.svg`
- Create: `assets/message/avatar-delta.svg`
- Create: `assets/message/avatar-ada.svg`

**Interfaces:**
- Consumes: Figma 文件 `RiaC2pmggaf13Xisz9X0I2` 的节点 `13:8692`。
- Produces: 可由 `expo-image` 静态 `require()` 的八个 SVG 文件。

- [ ] **Step 1: 读取 Expo 57 对 SVG 静态资源与 `expo-image` 的版本化文档**

Run: `curl -L https://docs.expo.dev/versions/v57.0.0/sdk/image/`

Expected: 文档确认当前项目所用 `expo-image` 的静态资源用法；若 SVG 限制与现有项目行为冲突，以项目中已经工作的 SVG 用法为准。

- [ ] **Step 2: 使用 Figma MCP 导出顶部图标和完整头像节点**

导出节点：返回 `I13:8697;3074:1162;3074:877`、清空 `I13:8699;3074:1097;3074:877`、搜索 `I13:8699;3074:1130;3074:877`、系统通知 `I13:8702;1835:16240`，以及四个普通头像 `I13:8703;1835:16240` 至 `I13:8706;1835:16240`。导出完整头像实例而不是内部栅格填充，以保留圆形遮罩并满足 SVG 格式要求。

- [ ] **Step 3: 校验资源文件**

Run: `file assets/message/*.svg`

Expected: 八个文件均存在且可识别为 SVG/XML 文本，无 PNG 内容伪装为 `.svg`。

- [ ] **Step 4: 提交资源**

```bash
git add assets/message
git commit -m "assets: add message tab figma icons"
```

---

### Task 2: 建立消息展示模型与静态数据

**Files:**
- Create: `src/features/message/message.types.ts`
- Create: `src/features/message/message.data.ts`

**Interfaces:**
- Consumes: Task 1 的八个静态 SVG。
- Produces: `MessageListItemModel` 类型和只读 `MESSAGE_ITEMS` 数组。

- [ ] **Step 1: 写出引用尚不存在类型的数据文件**

`message.data.ts` 导入 `MessageListItemModel` 并声明五项数据：系统通知、王者小妲己、Sorry全场、三角洲攻略哥、A达王；文本和时间严格使用 Figma 文案。

- [ ] **Step 2: 运行类型检查验证失败**

Run: `npx tsc --noEmit`

Expected: FAIL，提示 `message.types` 或 `MessageListItemModel` 不存在。

- [ ] **Step 3: 添加最小展示类型**

```ts
import type { ImageSource } from "expo-image";

export type MessageListItemModel = {
  id: string;
  kind: "system" | "conversation";
  title: string;
  preview: string;
  time: string;
  avatar: ImageSource;
};
```

`MESSAGE_ITEMS` 使用 `satisfies readonly MessageListItemModel[]`，确保字段和资源类型在编译期校验。

- [ ] **Step 4: 运行类型检查验证通过**

Run: `npx tsc --noEmit`

Expected: PASS。

- [ ] **Step 5: 提交模型与数据**

```bash
git add src/features/message/message.types.ts src/features/message/message.data.ts
git commit -m "feat: add message list display data"
```

---

### Task 3: 实现顶部栏与消息列表项

**Files:**
- Create: `src/features/message/components/MessageHeader.tsx`
- Create: `src/features/message/components/MessageListItem.tsx`

**Interfaces:**
- Consumes: `MessageListItemModel` 和 Task 1 的顶部 SVG。
- Produces: `MessageHeader({ onBack, onClear, onSearch })` 与 `MessageListItem({ item, isLast, onPress })`。

- [ ] **Step 1: 在临时引用文件中引用尚不存在的组件**

在后续页面文件创建前，先创建两个组件文件的导出壳并让 props 使用尚未声明的类型，以验证 TypeScript 能捕获接口缺失。

- [ ] **Step 2: 运行类型检查验证失败**

Run: `npx tsc --noEmit`

Expected: FAIL，提示 props 类型或导出未定义。

- [ ] **Step 3: 实现 `MessageHeader`**

使用 44 高的横向 `View`，左侧 44×44 返回按钮、右侧各 44×44 的清空和搜索按钮，中间弹性留白。三个 `Pressable` 分别设置 `accessibilityRole="button"` 和“返回”“清空消息”“搜索消息”标签；图标以 24×24 渲染，按压时透明度降至 0.6。

- [ ] **Step 4: 实现 `MessageListItem`**

使用 16 像素内边距、40×40 圆形头像、12 像素间距。文本列 `flex: 1`，第一行标题和时间分别允许标题收缩、时间不收缩；摘要 `numberOfLines={1}`。分割线绝对定位于左侧 68 像素之后，最后一项不绘制。根节点为 `Pressable`，提供 `${item.title}，${item.preview}` 无障碍标签。

- [ ] **Step 5: 运行 lint 与类型检查**

Run: `npm run lint && npx tsc --noEmit`

Expected: PASS。

- [ ] **Step 6: 提交可复用组件**

```bash
git add src/features/message/components
git commit -m "feat: add message list components"
```

---

### Task 4: 组装消息页面并替换占位路由

**Files:**
- Create: `src/features/message/screens/MessageScreen.tsx`
- Modify: `src/app/(tabs)/message.tsx`

**Interfaces:**
- Consumes: `MESSAGE_ITEMS`、`MessageHeader`、`MessageListItem`、Expo Router 和安全区。
- Produces: 默认导出的 `MessageScreen`，由 `MessageRoute` 挂载。

- [ ] **Step 1: 先修改路由引用尚不存在的 `MessageScreen`**

```tsx
import MessageScreen from "@/features/message/screens/MessageScreen";

export default function MessageRoute() {
  return <MessageScreen />;
}
```

- [ ] **Step 2: 运行类型检查验证失败**

Run: `npx tsc --noEmit`

Expected: FAIL，提示 `MessageScreen` 模块不存在。

- [ ] **Step 3: 实现 `MessageScreen`**

页面根节点 `flex: 1` 且背景 `#F7F7F7`，以 `paddingTop: insets.top` 避开真实状态栏。顶部栏位于列表之外；`FlatList` 使用 `MESSAGE_ITEMS`、稳定的 `keyExtractor`、`showsVerticalScrollIndicator={false}`，底部 padding 为 `80 + insets.bottom`，避免内容被绝对定位的 `AppTabBar` 遮挡。返回操作仅在 `router.canGoBack()` 为真时调用 `router.back()`；其余暂未落地业务回调用空函数并保持组件接口。

- [ ] **Step 4: 运行 lint 与类型检查**

Run: `npm run lint && npx tsc --noEmit`

Expected: PASS，且占位页引用从消息路由消失，订单路由仍继续使用占位页。

- [ ] **Step 5: 提交页面与路由**

```bash
git add src/features/message/screens/MessageScreen.tsx 'src/app/(tabs)/message.tsx'
git commit -m "feat: implement message tab screen"
```

---

### Task 5: 最终视觉与工程验证

**Files:**
- Modify only if validation exposes a defect in Task 1–4 files.

**Interfaces:**
- Consumes: 完整消息 Tab。
- Produces: 可交付的跨平台页面。

- [ ] **Step 1: 检查变更范围和格式**

Run: `git diff --check HEAD~3 && git status --short`

Expected: 无空白错误；用户已有 `md/` 文件不被修改或覆盖。

- [ ] **Step 2: 运行最终静态验证**

Run: `npm run lint && npx tsc --noEmit`

Expected: 两条命令均以 0 退出。

- [ ] **Step 3: 在 375 像素宽度验证页面**

启动现有 Expo 开发环境，确认真实状态栏下方依次为 44 高顶部栏和五条消息；标题/时间不重叠，长摘要单行省略，底部消息项不被 `AppTabBar` 遮挡。

- [ ] **Step 4: 在不同安全区验证**

至少验证一个带底部 Home Indicator 的 iOS 尺寸和一个 Android 尺寸，确认顶部安全区、底部列表 padding 和现有 TabBar 正常。

- [ ] **Step 5: 若验证产生修复则提交**

```bash
git add assets/message src/features/message 'src/app/(tabs)/message.tsx'
git commit -m "fix: polish message tab layout"
```

