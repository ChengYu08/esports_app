# 关于页·检查更新接入版本管理接口实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 关于盼之电竞页"检测更新"按钮接 `/client/v1/desktopVersion/public/latest`（按平台+当前版本号），本地版本 ≥ 接口版本提示"已是最新"，低于则提示去应用中心下载。

**Architecture:** 版本比较纯函数（TDD）+ API 调用模块（标准 `{success, code:"SUCCESS", data}` 包络，实测确认）+ AboutScreen 接线（Alert 提示，检查中禁用按钮）。

**Spec:** Figma 无新 UI（沿用现有关于页样式）；后端 `ClientDesktopVersionController.getLatest`（实测：ANDROID 返回 0.0.1/needForceUpdate=1；带 currentVersion 时 dev 环境后端旧版会 500——客户端需容错）。

## Global Constraints

- 零新增依赖；平台映射 android→ANDROID / ios→IOS；本地版本号取 `Constants.expoConfig.version`。
- 版本比较按"."分段数字比较（可含 v 前缀/非数字段容错，与后端 VersionNoUtils 行为一致）。
- 接口失败（网络/500）不崩溃：toast/Alert 提示稍后重试。

### Task 1: 版本比较纯函数（TDD）

**Files:** Create `src/features/mine/utils/version-compare.ts` + test

**Interfaces:** `compareVersionNos(a: string, b: string): -1 | 0 | 1`（a<b→-1；相等含补零对齐（1.0 vs 1.0.0）→0；a>b→1；v 前缀与非数字段容错）。

- [ ] 失败测试（相等/小于/大于/补零/v前缀/非数字）→ 实现 → 通过 → Commit

### Task 2: API + AboutScreen 接线

**Files:** Create `src/features/mine/api/desktop-version.api.ts`；Modify `AboutScreen.tsx`

- [ ] API：`fetchLatestDesktopVersion(platform, currentVersion)` → DesktopVersionInfo（versionNo/packageUrl/updateContent/needForceUpdate/forceUpdate）
- [ ] AboutScreen：checkForUpdate 改为异步——检查中按钮禁用；`compareVersionNos(local, latest) >= 0` → Alert"当前已是最新版本"；否则 Alert"发现新版本"（含版本号与更新内容 + 请前往应用中心下载）；请求失败 Alert 稍后重试
- [ ] tsc + lint + vitest 全绿 + Commit
