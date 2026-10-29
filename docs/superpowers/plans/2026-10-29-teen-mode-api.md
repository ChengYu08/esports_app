# 青少年模式服务端对接实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 青少年模式从本地 mock（明文密码存本地）切换到 pzdj-service 服务端接口（/client/v1/youth/*），实现启动状态拦截页 + 每日首启促销弹窗 + 开启/关闭全流程。

**Architecture:** 新增 API 合约层（可注入 requester，便于测试）+ 弹窗规则纯函数（TDD）+ 根布局启动门（enabled=锁定页 / 未开启=每日促销弹窗）+ TeenModeScreen 状态机改为服务端驱动。本地存储仅保留：弹窗日记录、不再弹标记、最近一次 enabled 镜像（基础设置行展示用）。

**Tech Stack:** 已有依赖，零新增。

**Spec:** 后端 `pzdj-service/docs/youth-mode-api.md` + `ClientYouthModeController`；产品规则（用户补充）；弹窗 UI Figma 571-59836（Dialog/custom 295×319：插画 240×103、标题"青少年模式"600/16/24 #333、正文、checkbox"后续不再重复弹出"400/12/18 #808080、去开启 96×36 r8 白底字#333 / 我知道了 155×36 r8 #FE1F4C 白字 600/14/22）。

## Global Constraints

- 接口：POST `/client/v1/youth/status|password|open|close`，`token` 请求头，请求体 `{ "action": {...} }` 包络；响应 `R = { code: 0(数字), msg, data }`，`Number(code) === 0` 视为成功（对 "0" 字符串容错）。
- 密码 4 位数字（沿用 `teen-mode.ts` 的 `filterDigits/isPasswordComplete`）。
- 校验失败 toast 文案：两次不一致→"前后两次密码不一致"；关闭密码错误→服务端 msg（"密码有误，今日还剩x次机会！"）；当日超限→服务端 msg。
- 弹窗规则（客户端缓存驱动）：已登录 && 本次启动非登录发生的 && 未勾选"不再重复弹出" && `lastDismissedDate !== 今天` → 弹；弹过（关闭/去开启）即记 `lastDismissedDate = 今天`；勾选→ `dontAsk = true` 永久不再弹；删除缓存重新触发。
- `enabled=true` 时根布局渲染青少年模式锁定页覆盖全部功能；关闭成功后门禁解除。
- 状态 API 仅登录后调用；"完成登录后的下次启动才弹窗"——登录发生在本次启动时本次不弹（auth 流程打标记）。
- 中文注释；`if () { return; }` 块写法；不改后端。

## Review Focus

- promise 悬挂/竞态：status 请求期间用户操作、连续快速开关。
- 缓存时区：dismissedDate 用本地时区日期字符串，跨天判定正确。
- 未登录→登录边界：登出后 gate/弹窗必须全部消失且状态重置。
- R 包络异常形态（code 非 0 / data 缺失）不得崩溃，走 toast。

---

### Task 1: 青少年模式 API 合约层（TDD）

**Files:**
- Create: `src/features/mine/api/teen-mode.contract.ts`（`createTeenModeApi(requester)` + R 包络类型 + 默认实例走 apiClient）
- Modify: 无（apiClient 已支持任意 JSON 包络）
- Test: `src/features/mine/api/teen-mode.contract.test.ts`

**Interfaces:**
- Produces:
```ts
export type TeenModeStatus = { enabled: boolean; passwordSet: boolean; remainingAttempts: number };
export function createTeenModeApi(requester: (path: string, options: { method: "POST"; token?: string; body?: unknown }) => Promise<{ code: number | string; msg?: string; data?: T }>): {
  status(token): Promise<TeenModeStatus>;
  open(token, password: string, confirmPassword?: string): Promise<TeenModeStatus>;
  close(token, password: string): Promise<TeenModeStatus>;
  setPassword(token, opts: { oldPassword?: string; password: string; confirmPassword: string }): Promise<TeenModeStatus>;
};
```
- 成功判定 `Number(code) === 0`，data 缺失视为业务错误；失败抛 `Error(msg)`。

- [ ] Step 1: 失败测试：4 个接口的 path/method/body（action 包络）/token 透传 + code!==0 抛错 + data 缺失抛错
- [ ] Step 2: 运行确认失败
- [ ] Step 3: 实现合约层（默认实例用 apiClient）
- [ ] Step 4: 测试通过 + tsc + Commit `feat: 青少年模式服务端接口合约层`

### Task 2: 弹窗规则纯函数（TDD）

**Files:**
- Create: `src/features/mine/utils/teen-popup.ts`
- Test: `src/features/mine/utils/teen-popup.test.ts`

**Interfaces:**
- Produces:
```ts
export function todayString(now?: Date): string; // 本地时区 YYYY-MM-DD
export function shouldShowTeenPopup(cache: { dontAsk: boolean; lastDismissedDate?: string }, today: string): boolean;
```

- [ ] Step 1: 失败测试：dontAsk=true→false；lastDismissedDate=today→false；lastDismissedDate=昨天→true；无记录→true
- [ ] Step 2: 确认失败
- [ ] Step 3: 实现
- [ ] Step 4: 通过 + Commit `feat: 青少年弹窗每日首启规则`

### Task 3: 启动门 + 促销弹窗 + 状态镜像

**Files:**
- Create: `src/features/mine/components/TeenModePromoDialog.tsx`（设计稿 571-59836 弹窗）
- Create: `src/features/mine/components/TeenModeGate.tsx`（status 拉取 + enabled 锁定页 + 弹窗调度）
- Modify: `src/app/_layout.tsx`（已登录时挂 `<TeenModeGate />`）
- Modify: `src/features/mine/teen-mode-store.ts`（重写：弹窗缓存 + lastEnabled 镜像；删除明文密码记录）
- Modify: `src/features/auth/client-auth-flow.ts`（completeClientLogin 标记本次启动发生登录，供弹窗规则"下次启动才弹"）

**Interfaces:**
- Consumes: Task 1 api、Task 2 规则、auth store（token/user）。
- Produces: `TeenModeGate` 挂件（无 props，内部自取 token；未登录渲染 null）。

- [ ] Step 1: 重写 teen-mode-store（`readTeenPopupCache/saveTeenPopupCache`、`readLastTeenEnabled/saveLastTeenEnabled`），删除旧 readTeenMode/saveTeenMode/clearTeenMode
- [ ] Step 2: 促销弹窗组件（插画切图 + checkbox + 去开启/我知道了；勾选→dontAsk；任一按钮→记当日 + 关闭；去开启另 push /teen-mode）
- [ ] Step 3: TeenModeGate：本次启动一次性 status 拉取（登录后），enabled→渲染锁定页（复用 TeenModeScreen enabled 视图），未启用→按规则弹促销弹窗；登出重置
- [ ] Step 4: client-auth-flow 打登录标记
- [ ] Step 5: tsc + lint + vitest 通过
- [ ] Step 6: Commit `feat: 青少年模式启动门与每日促销弹窗`

### Task 4: TeenModeScreen 服务端驱动改造

**Files:**
- Modify: `src/features/mine/screens/TeenModeScreen.tsx`（状态机改服务端：status 拉取、开启（设密/验密两分支）、关闭（剩余次数展示）、改密暂不做 UI）
- Modify: `src/features/mine/screens/BasicSettingsScreen.tsx`（行值改为读 lastEnabled 镜像）

- [ ] Step 1: 状态机改造（!enabled：未设密→设密+开启（两次校验不一致 toast"前后两次密码不一致"）；已设密→输密码开启。enabled：输密码关闭，失败 toast 服务端 msg，成功刷新 status）
- [ ] Step 2: BasicSettings 行值接镜像
- [ ] Step 3: tsc + lint + vitest 全绿
- [ ] Step 4: Commit `feat: 青少年模式页接服务端接口`

### Task 5: 全量验证 + 真机冒烟说明

- [ ] `npx tsc --noEmit`、`npx expo lint`、`npx vitest run` 全绿
- [ ] Commit 遗漏（如有）
- [ ] 真机冒烟清单输出（登录→次日弹窗/勾选不再弹→去开启→设密开启→杀进程重开锁定→输密码关闭→错误次数提示）
