# 编辑个性签名页实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 编辑资料页点击"个性签名"进入独立"编辑个性签名"页（设计稿 253-36956 + 补充说明 361-40424），保存走老接口 updateProfile。

**Architecture:** 与"编辑名字"页同构：校验纯函数（TDD）+ 独立路由页 + EditProfileScreen 个性签名行改跳转。

**Tech Stack:** 已有依赖，零新增。

**Spec:** Figma 253-36956（页面：多行输入卡 351×142 r8、placeholder"请填写简介"、计数胶囊 x/100、说明"最多100字，7天内可修改3次简介"、右上"保存"）；361-40424（超限计数变红；>100 字保存 → toast"简介内容不能超过100字"并停留本页）。页面标题按用户要求用"编辑个性签名"。

## Global Constraints

- 上限 100 字（TextInput maxLength=100，按 `Array.from` 字符计）；计数 n==100 时变红 `#FF4754`（漏掉即缺陷）。
- 保存校验：超 100 字 → toast"简介内容不能超过100字"并停留本页；空值=清空简介，允许。
- 接口：`clientAuthApi.updateProfile(token, { signature })`；成功后 saveAuthSession+setSession 同步并返回。

### Task 1: 签名校验纯函数（TDD）

**Files:** Create `src/features/mine/utils/signature-rules.ts`、`signature-rules.test.ts`
**Interfaces:** `validateSignature(value: string): string | null`（null=通过；>100 字符→"简介内容不能超过100字"）。

- [ ] Step 1: 失败测试（空串通过=清空；100 字通过；101 字符→toast 文案）
- [ ] Step 2: 运行确认失败
- [ ] Step 3: 实现
- [ ] Step 4: 通过 + Commit `feat: 个性签名校验纯函数`

### Task 2: 编辑个性签名页 + 路由 + 接线

**Files:** Create `src/features/mine/screens/EditSignatureScreen.tsx`、`src/app/edit-signature.tsx`；Modify `EditProfileScreen.tsx`（个性签名行改跳转；BottomSheet signature 分支移除，EditField 收窄为 "gender"|"birth"）。

- [ ] Step 1: 实现页面（params.signature 预填；多行 TextInput maxLength 100、计数满 100 变红 #FF4754；右上保存 → 校验 → updateProfile → 同步 → back）
- [ ] Step 2: 路由 + 个性签名行跳转接线（params.signature）
- [ ] Step 3: `npx tsc --noEmit` + `npx expo lint` + vitest 全绿
- [ ] Step 4: Commit `feat: 编辑资料页个性签名跳转独立编辑页`
