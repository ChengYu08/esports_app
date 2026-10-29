# 编辑名字页实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 编辑资料页点击"昵称"进入独立的"编辑名字"页（设计稿 253-36947 + 补充说明 361-40380），保存走老个人设置接口 updateProfile。

**Architecture:** 纯函数校验器（TDD）+ 独立路由页 + EditProfileScreen 昵称行改为跳转。保存后经 toAuthUser/saveAuthSession/setSession 同步全局登录态。

**Tech Stack:** 已有依赖，零新增。

**Spec:** Figma 253-36947、361-40380（补充说明：未输入 placeholder"请填写名字"、计数胶囊 x/18、超出/非法字符的 toast 文案）。

## Global Constraints

- 计数：按 `Array.from(value).length`（emoji 计 1）；输入上限 18（TextInput maxLength）。
- 保存校验顺序：先字符合法性（`[@<>/]` → toast"不能包含@<>/等无效字符"），再长度（trim 后 `Array.from` 长度 <2 或 >24 → toast"请设置2-24个字符"）；失败停留在本页。
- 接口：`clientAuthApi.updateProfile(token, { nickname })`（老个人设置接口）；成功后 `saveAuthSession`+`setSession` 同步。
- 中文注释；`if () { return; }` 块写法；不加新依赖。

### Task 1: 昵称校验纯函数（TDD）

**Files:**
- Create: `src/features/mine/utils/nickname-rules.ts`
- Test: `src/features/mine/utils/nickname-rules.test.ts`

**Interfaces:**
- Produces: `validateNickname(value: string): string | null`（null=通过；否则返回 toast 文案）。

- [ ] Step 1: 写失败测试：空串/"a"（1字）→"请设置2-24个字符"；25字→同；"ab"→null；恰好24字→null；"a@b"→"不能包含@<>/等无效字符"；"a<b>c/d"→同
- [ ] Step 2: 运行确认失败（模块不存在）
- [ ] Step 3: 实现
- [ ] Step 4: 跑测试通过 + Commit `feat: 昵称编辑校验纯函数`

### Task 2: 编辑名字页 + 路由 + 入口接线

**Files:**
- Create: `src/features/mine/screens/EditNicknameScreen.tsx`
- Create: `src/app/edit-nickname.tsx`
- Modify: `src/features/mine/screens/EditProfileScreen.tsx`（昵称行改跳转；BottomSheet 的 nickname 分支移除）

**UI 规格（Figma 253-36947）**: bg #F7F7F7；nav 左返回 44×44（#0A0A0A）、居中标题"编辑名字" 600/16/24 #333333、右上"保存" 400/14/22 #333333（pad 右 16）；内容 pad 16：输入卡白底 r8（pad 12/8/12/12），TextInput placeholder"请填写名字" #CCCCCC、文字 #333 400/14/22、maxLength 18，卡片右下计数胶囊 pad 8/4：`n`（已输入时 #999999，空时 #CCCCCC）+ "/" + "18"（#CCCCCC）；下方说明 400/12/18 #808080"最多18字，不能使用@<>/等无效字符，30天内可修改4次名字"。

- [ ] Step 1: 实现页面（params.nickname 预填；保存→validateNickname→toast 或 updateProfile→同步→back）
- [ ] Step 2: 路由文件 + EditProfileScreen 昵称行 `router.push({ pathname: "/edit-nickname", params: { nickname } })`；移除 BottomSheet nickname 分支与 editTitle 分支
- [ ] Step 3: `npx tsc --noEmit` + `npx expo lint` 通过
- [ ] Step 4: Commit `feat: 编辑资料页昵称跳转独立编辑名字页`
