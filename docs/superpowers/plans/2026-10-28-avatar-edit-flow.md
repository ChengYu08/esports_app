# 头像编辑流程（自定义相册页 + 自绘圆形裁剪器）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 替换 EditProfileScreen 的系统选图链路为"自定义相册选择页（设计稿 253-37430）→ 自绘圆形裁剪页（设计稿 253-37423，双指捏合）→ 上传"的完整流程，双端补齐相册权限配置。

**Architecture:** 纯前端自研两页。相册页用 `expo-media-library` 列资产 + 缩略图网格；裁剪页用 gesture-handler 的 Pinch/Pan + reanimated 驱动图片变换，圆形挖孔遮罩用 4 块半透明矩形实现，确认时用 `computeAvatarCropRect`（纯函数）把屏幕圆形区域映射回原图坐标，`expo-image-manipulator` 裁剪+缩放输出 600×600 JPEG。页面间通过 promise 桥接模块回传裁剪结果。

**Tech Stack:** expo-media-library、expo-image-manipulator（新增，均为 Expo 官方双端模块）；react-native-gesture-handler、react-native-reanimated（已有）；vitest（已有）。

**Spec:** Figma 253-37430（选择照片页）、253-37423（裁剪-双指捏合）、253-36805（入口：编辑资料页）；本计划与 Figma 节点规格一同作为依据。

## Global Constraints

- 权限文案必须配置（审核红线）：`expo-media-library` 插件 `photosPermission` 使用中文文案；`savePhotosPermission: false`（不写相册，不加多余权限）。
- 双端（iOS/Android）都必须可构建；权限由 config plugin 在 prebuild 时注入，禁止手改 ios/android 产物。
- 裁剪输出：600×600 JPEG，compress 0.9。
- 裁剪手势缩放范围：zoom ∈ [1, 5]（1 = cover 铺满圆形区域）；图片任何时刻必须完全覆盖圆形视口（无黑边）。
- 交互与文案沿用现有页：取消/保存、Toast 反馈；不改上传接口链路（getOssSts "101" → uploadClientObject → updateProfile）。
- 纯函数模块（裁剪数学、session 桥）不得 import react-native（vitest 在 node 环境跑）。
- UI 色值/尺寸取自 Figma：遮罩 rgba(0,0,0,0.6)、圆孔直径 = 容器宽 × 295/375、底栏高 84、取消钮 #333（120 宽比例）、保存钮 #FE1F4C（211 宽比例）、按钮 42 高 r8、文字 500/14/22。

## Review Focus

- 原图为竖图/横图时 cover 缩放后裁剪框映射是否正确 → Task 3 测试覆盖竖/横/方图三组用例。
- 捏合缩放超出边界时是否始终覆盖视口（无黑边）→ Task 3 clamp 测试覆盖极端 offset。
- 用户在裁剪页取消后重新选图，promise 不应悬挂或重复 resolve → Task 2 测试覆盖 cancel→重选→complete 序列。
- 相册权限被拒（含 iOS limited）时页面不得白屏 → Task 4 的拒绝态渲染分支。
- 编辑资料页上传中重复点击"更换"不得并发上传 → Task 6 的编辑态禁用。

---

### Task 1: 依赖安装与双端权限配置

**Files:**
- Modify: `package.json`、`pnpm-lock`/`package-lock`（由 expo install 自动）
- Modify: `app.json`（plugins 数组）
- Test: `src/core/config/app-media-permission.test.ts`

**Interfaces:**
- Produces: `expo-media-library`、`expo-image-manipulator` 可 import；app.json plugins 含 `["expo-media-library", { photosPermission: 中文, savePhotosPermission: false }]`。

- [ ] **Step 1: 写失败测试**（读取 app.json 断言插件与文案，防止后续被移除导致审核被拒）

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("配置 expo-media-library 相册权限文案（双端审核要求）", () => {
  const appJson = JSON.parse(
    readFileSync(resolve(__dirname, "../../../../app.json"), "utf8"),
  );
  const entry = appJson.expo.plugins.find(
    (p: unknown) => Array.isArray(p) && p[0] === "expo-media-library",
  ) as unknown[] | undefined;
  expect(entry).toBeTruthy();
  expect((entry![1] as { photosPermission: string }).photosPermission).toContain("照片");
  expect((entry![1] as { savePhotosPermission: boolean }).savePhotosPermission).toBe(false);
});
```

- [ ] **Step 2: 跑测试确认失败**：`npx vitest run src/core/config/app-media-permission.test.ts` → FAIL（无插件）
- [ ] **Step 3: 安装并配置**：`npx expo install expo-media-library expo-image-manipulator`；app.json plugins 追加 `["expo-media-library", { "photosPermission": "允许盼之电竞访问你的照片，用于选择头像图片。", "savePhotosPermission": false }]`（放在 withVoiceRoomBackground 之后）
- [ ] **Step 4: 跑测试通过** + `npx tsc --noEmit`
- [ ] **Step 5: Commit** `feat: 引入相册选择与图片裁剪官方模块并配置双端权限`

### Task 2: 头像编辑会话桥接（promise 回传裁剪结果）

**Files:**
- Create: `src/features/mine/utils/avatar-edit-session.ts`
- Test: `src/features/mine/utils/avatar-edit-session.test.ts`

**Interfaces:**
- Produces: `beginAvatarEdit(): Promise<string | null>`（EditProfileScreen 专用，进入流程前调用）；`completeAvatarEdit(uri: string | null): void`（相册页关闭时、裁剪页取消/保存时调用；null=取消）。约束：同一时刻仅一个 pending 会话；未 begin 时 complete 为 no-op。

- [ ] **Step 1: 写失败测试**：begin→complete("file://x") 解析出 uri；complete(null) 解析 null；未 begin 时 complete 不抛错；重复 complete 只影响新会话
- [ ] **Step 2: 运行确认失败**（模块不存在）
- [ ] **Step 3: 实现**：模块级 `resolver` 单槽，begin 覆盖存储并返回新 promise；complete 调用当前 resolver 后清空
- [ ] **Step 4: 跑测试通过**
- [ ] **Step 5: Commit** `feat: 头像编辑会话桥接模块`

### Task 3: 裁剪数学 computeAvatarCropRect（TDD）

**Files:**
- Create: `src/features/mine/utils/avatar-crop.ts`
- Test: `src/features/mine/utils/avatar-crop.test.ts`

**Interfaces:**
- Produces:
```ts
export function computeAvatarCropRect(input: {
  imageWidth: number;   // 原图像素宽
  imageHeight: number;  // 原图像素高
  containerSize: number; // 裁剪视口边长（屏宽），圆形内切其中
  circleRatio: number;   // 圆直径 / 容器边长 = 295/375
  scale: number;         // 实际显示比例 = cover 基准 × zoom（容器像素/原图像素）
  offsetX: number;       // 图片相对"居中"位置的平移（容器像素）
  offsetY: number;
}): { originX: number; originY: number; size: number }; // 原图像素坐标，已取整并 clamp 进图界
```
- 算法（Task 实现者按此写）：imageLeft = (containerSize - imageWidth×scale)/2 + offsetX；圆左 = (containerSize - containerSize×circleRatio)/2；origin = (圆左 - imageLeft)/scale；size = containerSize×circleRatio/scale；取整并 clamp 到 [0, imageWidth/Height - size]。

- [ ] **Step 1: 写失败测试**：方图 zoom=1（origin 0,0，size=短边）；竖图 1080×1920 容器 375（cover 后 originY 居中裁出方块）；横图同理；offsetX/Y 极端平移时 clamp 不越界（origin ≥ 0 且 origin+size ≤ 边界）
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现纯函数**（不 import react-native）
- [ ] **Step 4: 跑测试通过**
- [ ] **Step 5: Commit** `feat: 头像裁剪区域计算纯函数`

### Task 4: 自定义相册选择页（设计稿 253-37430）

**Files:**
- Create: `src/features/mine/screens/AvatarAlbumScreen.tsx`
- Create: `src/app/avatar-album.tsx`（`export default AvatarAlbumScreen`）

**Interfaces:**
- Consumes: `expo-media-library`（requestPermissionsAsync / getAlbumsAsync / getAssetsAsync / getThumbnailsAsync）；`completeAvatarEdit(null)`（关闭时）。
- Produces: 点图片 → `router.push({ pathname: "/avatar-crop", params: { uri, width: String(asset.width), height: String(asset.height) } })`。

**UI 规格（Figma 253-37430）**：白底；导航左 close X（24，#333），标题"最近项目" 600/16/24 #333 + 下拉箭头 16（点开相册列表：最近项目 + getAlbumsAsync 过滤 assetCount>0）；网格 4 列（格宽 = 屏宽/4），正方形缩略图（getThumbnailsAsync）；权限拒绝态显示说明 + "去授权"按钮；分页 onEndReached（first 60，hasNextPage→after endCursor）；仅 `mediaType: ["photo"]`，按创建时间倒序。设计稿中的 filter 图标无对应功能，本次刻意不做。

- [ ] **Step 1: 实现页面 + 路由**（一次写完：权限态/下拉/网格/分页/tap 跳转/关闭 completeAvatarEdit(null)+back）
- [ ] **Step 2: `npx tsc --noEmit` + `npx expo lint` 通过**
- [ ] **Step 3: Commit** `feat: 自定义相册选择页`

### Task 5: 自绘圆形裁剪页（设计稿 253-37423）

**Files:**
- Create: `src/features/mine/screens/AvatarCropScreen.tsx`
- Create: `src/app/avatar-crop.tsx`

**Interfaces:**
- Consumes: `computeAvatarCropRect`（Task 3）、`completeAvatarEdit`（Task 2）、route params `{ uri, width, height }`、`expo-image-manipulator`（crop→resize 600→saveAsync JPEG 0.9）。
- Produces: 保存 → `completeAvatarEdit(result.uri)` + `router.dismiss(2)`；取消 → `completeAvatarEdit(null)` + `router.back()`。

**UI 规格**：黑底；图片区在安全区下方，边长 = 屏宽，图片 cover 居中；圆形遮罩：全屏 rgba(0,0,0,0.6) 挖孔（4 矩形拼装），圆直径 = 屏宽 × 295/375，圆心与图片区中心重合；底部白条高 84：取消钮（bg #333，flex 比例 120）+ 保存钮（bg #FE1F4C，flex 比例 211），42 高 r8，文字白 500/14/22；StatusBar light。手势：Pinch（zoom [1,5]，以双指焦点为缩放中心可简化为以视口中心）+ Pan，worklet 内 clamp 保证图片覆盖圆形视口；保存时若 crop 计算中 saving 态按钮禁用。

- [ ] **Step 1: 实现页面 + 路由**
- [ ] **Step 2: `npx tsc --noEmit` + `npx expo lint` 通过**
- [ ] **Step 3: Commit** `feat: 自绘圆形头像裁剪页（双指捏合）`

### Task 6: EditProfileScreen 接入新流程

**Files:**
- Modify: `src/features/mine/screens/EditProfileScreen.tsx`（changeAvatar 重写）

**Interfaces:**
- Consumes: `beginAvatarEdit`（Task 2）、`computeAvatarCropRect` 的输出 uri（Task 5 产出并回传）、既有上传链路 `clientAuthApi.getOssSts(token,"101",[fileName])` → `uploadClientObject` → `clientAuthApi.updateProfile(token,{headImage})` → `applyProfile`。

- [ ] **Step 1: 重写 changeAvatar**：`MediaLibrary.requestPermissionsAsync()` 拒绝 → Toast；`beginAvatarEdit()` → `router.push("/avatar-album")` → `await` 结果；null 直接 return；有 uri → 上传（文件名 `avatar-${Date.now()}.jpg`）→ `applyProfile` → Toast"头像已更新"；期间按钮禁用（新增 `avatarEditing` 态覆盖"更换/上传中"文案）。移除 expo-image-picker 的 import 与用法。
- [ ] **Step 2: `npx tsc --noEmit` + `npx expo lint` 通过**
- [ ] **Step 3: Commit** `feat: 编辑资料页接入自定义选图与裁剪流程`

### Task 7: 全量验证与真机说明

- [ ] `npx tsc --noEmit`、`npx expo lint`、`npx vitest run` 全绿
- [ ] Commit 遗漏文件（如有）
- [ ] 输出说明：dev client 含新原生模块需重编一次（Android 本地 `gradlew assembleDebug`；iOS 走 EAS/Mac）；CI 包自动包含。真机冒烟路径：编辑资料→更换→选图→捏合缩放→保存→上传成功、我的/主页头像同步。
