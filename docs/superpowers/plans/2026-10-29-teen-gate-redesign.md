# 青少年模式锁定页与关闭流程按新设计校准

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 启动门禁锁定页按设计稿 274-46336 更新文案与布局；关闭流程改为两次输入（设计稿 274-46328），正确性校验走后端 /youth/close，成功后解除门禁回首页。

**Spec:** Figma 274-46336（锁定页：三条 star bullet 文案、"可在设置中查看未成年人模式" notice、全宽红色关闭按钮）；274-46328（"再次输入密码"页：副标题"该密码将用于解锁青少年模式"、红色光标、下方忘记密码提示文案）。

## Global Constraints

- 密码正确性校验必须走后端 `/youth/close`（禁走本地 mock）；两次输入一致性为前端校验，不一致 toast"前后两次密码不一致"并回第一次输入。
- 密码输入光标红色 `#FE1F4C`。
- 锁定页仍在所有界面之上（TeenModeGate absoluteFill 覆盖，保持现状）。
- 中文注释；不加依赖。

### Task: 实现

**Files:** Modify `src/features/mine/screens/TeenModeScreen.tsx`（Phase 增加 disableConfirm；enabled overview 文案/notice；密码页标题/副标题/光标色/提示行；关闭两次输入逻辑）。

- [ ] Step 1: 实现全部改动
- [ ] Step 2: `npx tsc --noEmit` + `npx expo lint` 通过
- [ ] Step 3: Commit `feat: 青少年模式锁定页与关闭流程按设计稿校准`
