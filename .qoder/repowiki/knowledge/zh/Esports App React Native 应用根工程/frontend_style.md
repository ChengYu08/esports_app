## 1. 使用的系统与工具

- **样式方案**：全部使用 React Native 内置的 `StyleSheet.create`，未见 Tailwind、Styled Components、Emotion、Sass/SCSS、Less 等第三方 CSS-in-JS 或预处理器依赖。搜索结果显示约 3008 处 `StyleSheet.create` 调用，覆盖 173 个文件。
- **设计令牌（Design Tokens）**：集中在 `src/shared/theme/tokens.ts`，导出三类原子值——颜色、间距、圆角。
- **字体系统**：集中在 `src/shared/theme/typography.ts`，定义 PingFang SC、D-DIN-PRO 字族及 `SYSTEM_FONT` 平台回退策略，并通过 `getDDinProStyle(weight)` 返回 `{ fontFamily, fontWeight }` 片段。
- **渐变**：因 `expo-linear-gradient` 在 Fabric replace 下崩溃，自定义 SVG 线性渐变组件 `MatchLinearGradient`（`src/features/match/components/MatchLinearGradient.tsx`），通过 `react-native-svg` 实现。
- **无全局 CSS 文件**：仓库中不存在 `.css` / `.scss` / `.less` 源文件；所有视觉样式均内联于 TSX/TS 模块。

## 2. 关键文件

- `src/shared/theme/tokens.ts` — 全局 design tokens（colors / spacing / radius）
- `src/shared/theme/typography.ts` — 字体注册、D-DIN-PRO weight 映射、SYSTEM_FONT 平台选择
- `src/shared/ui/*` — 共享 UI 组件（Skeleton、AppTabBar、BottomSheet、ScreenHeader、CompanionCard、ImagePreview、StartupSplash、AsyncStates、AppPrompt 等），统一使用 StyleSheet + tokens
- `src/features/court/complaint.styles.ts` — 单一 feature 内按文件组织 StyleSheet 的示例
- `src/features/match/components/MatchLinearGradient.tsx` — 替代 expo-linear-gradient 的 SVG 渐变组件
- `assets/fonts/` — D-DIN-PRO 系列 ttf 资源（300–900）

## 3. 架构与约定

### 3.1 主题分层

```text
src/shared/theme/
├── tokens.ts          # colors / spacing / radius 原子值
└── typography.ts      # 字体家族、weight 映射、SYSTEM_FONT
```

业务组件通过相对路径引用这些模块，例如：

- `import { colors, spacing, radius } from "../shared/theme"`（如 `features/search/components/ClubSearchCard.tsx`）
- `import { SYSTEM_FONT } from "../shared/theme/typography"`（多处用于 Text 组件）

### 3.2 Design Tokens 内容

- **colors**：`brand`（#ff1f4c）、`brandSoft`、`text`、`textStrong`、`textMuted`、`textSecondary`、`surface`、`border`、`skeleton`、`skeletonHighlight`。
- **spacing**：`xs: 4` → `xl: 20`，步长 4。
- **radius**：`sm: 4`、`md: 8`、`lg: 12`、`pill: 15`。

### 3.3 字体约定

- 正文默认使用 `PingFang SC`，Android 回退到 `sans-serif`，其余平台回退到 `system-ui, sans-serif`。
- D-DIN-PRO 数字/标题字体通过 `require("../../../assets/fonts/D-DIN-PRO-{weight}.ttf")` 静态注册，weight 范围 300–900。
- 提供类型 `DDinProWeight = 300 | 400 | 500 | 600 | 700 | 800 | 900` 和工厂函数 `getDDinProStyle(weight)`。

### 3.4 StyleSheet 组织模式

两种常见模式并存：

1. **组件本地 StyleSheet**：每个 TSX 文件末尾用 `const styles = StyleSheet.create({...})` 定义，是最普遍的模式（见 Skeleton、AppTabBar、BottomSheet、ScreenHeader、CompanionCard 等）。
2. **feature 级样式文件**：将某 feature 的所有 StyleSheet 集中到一个 `.styles.ts` 文件中，例如 `src/features/court/complaint.styles.ts`，该文件还通过 `COURT_FONT_FAMILY` 引用 court 域的主题常量。

### 3.5 布局与响应式策略

- 使用 Flexbox 布局（`flexDirection`、`alignItems`、`justifyContent`、`gap`、`flexShrink`、`flexGrow`）。
- 不使用媒体查询；通过 `Platform.select`（见 typography.ts 的 `SYSTEM_FONT`）做平台差异化。
- 未引入专门的响应式断点库；屏幕适配依赖 RN 原生尺寸与百分比。

### 3.6 特殊处理

- 渐变：由于 `expo-linear-gradient` 在 Fabric replace 时出现 “View already has a parent” 崩溃，采用自研 `MatchLinearGradient` 组件，基于 `react-native-svg` 的 `<Defs>` + `<LinearGradient>` + `<Rect>` 渲染。
- 骨架屏：`src/shared/ui/Skeleton.tsx` 内部维护自己的 DEFAULT_RADIUS 和 baseColor/highlightColor 参数，但对外暴露的 props 仍遵循 tokens 语义。

## 4. 约定与约束（描述性观察）

- 所有 UI 样式以 `StyleSheet.create` 形式声明，未见任何 `.css`/`.scss`/`.less` 源文件，也未安装 Tailwind、Styled Components、Emotion 等 CSS-in-JS 框架。
- 主题色、间距、圆角必须从 `src/shared/theme/tokens.ts` 导入，避免在业务组件中直接写死十六进制颜色或像素值（可从 Search、Skeleton、Court 等组件的 import 观察到）。不过部分老代码（如 `complaint.styles.ts`）仍存在硬编码色值，说明该约定尚未被严格强制执行。
- 字体通过 `typography.ts` 中的 `SYSTEM_FONT` 与 `getDDinProStyle` 注入，不在组件里直接写死 font-family 字符串。
- 渐变效果统一走 `MatchLinearGradient` 组件，绕过 `expo-linear-gradient`。
- 无全局 CSS reset 或样式入口文件；样式是模块化的、就近声明的。
- 未使用 Sass/SCSS/Less/Tailwind 等预处理或原子化 CSS 工具链（package.json 中无相关依赖）。

## 5. 结论

该项目采用“React Native 原生 StyleSheet + 中心化 Design Tokens”的轻量前端风格体系：主题由 `tokens.ts` 与 `typography.ts` 统一管理，UI 组件各自持有 `StyleSheet.create` 块，跨模块复用通过 relative import 共享 tokens 与字体工具。它不是基于 CSS 或第三方 CSS-in-JS 的方案，而是典型的 React Native 原生样式工程。