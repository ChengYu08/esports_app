# 编辑性别浮层实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 编辑资料页"性别"行点击后弹出底部浮层（设计稿 253-37294 + 说明 361-40404），点选立即保存并收起，不再需要"保存"按钮。

**Architecture:** 改造 EditProfileScreen 现有 BottomSheet 的 gender 分支：标题行（"选择性别" + 叉号）+ 男/女 单选行；选中项打勾；点击行即 `updateProfile({ gender })` 立即生效后关闭浮层。

**Spec:** Figma 253-37294（浮层：标题"选择性别" 600/16/24 #333；两行单选 54 高、文字 400/14/22 #333）；361-40404（三条交互规则）。

## Global Constraints

- 点选项立即 `updateProfile({ gender })` 保存，成功后收起浮层；保存中选项禁用。
- 再次打开时已选项显示打勾（打勾色 #FE1F4C，品牌色——设计稿未给色值，作为假设记录）。
- 遮罩点击（现有 onClose）与叉号均可关闭。
- 选项仅 男(1)/女(2)，与设计稿一致（原"保密"选项移除——用户性别未设置时浮层内不预选任何项）。
- 生日编辑的 BottomSheet 保存按钮行为保持不变。

### Task: 实现与验证

**Files:** Modify `src/features/mine/screens/EditProfileScreen.tsx`（BottomSheet gender 分支重写；saveEdit 移除 gender；新增 saveGenderImmediate）。

- [ ] Step 1: 实现浮层 UI 与立即保存逻辑（含 saving 禁用）
- [ ] Step 2: `npx tsc --noEmit` + `npx expo lint` + vitest 全绿
- [ ] Step 3: Commit `feat: 编辑性别改为底部浮层点选立即生效`
