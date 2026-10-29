# 编辑资料·生日滚轮选择弹层实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 编辑资料页点击"生日"行弹出"选择日期"底部滚轮弹层（设计稿 1535-181296），选定后保存生日（birth）到服务端。纯 JS 滚轮（ScrollView snap），不引入原生组件。

**Spec:** Figma 1535-181296：弹层 375×344；标题行 56（取消 #999999 400/14/22、选择日期 500/16/24 #0D0D0F、确定 #0D0D0F 400/14/22）；滚轮区白底 254（上下 pad 12）、行高 46×5 居中、三列各 125、文字 400/14/22；选中行 #0D0D0F、±1 #999999、更远 #CACACA；行 label"生日"（空值 placeholder"请选择生日"）。

## Global Constraints

- 零新增依赖（ScrollView snapToInterval 实现，禁止原生组件）。
- 年份范围：当年-100 ~ 当年；月 1-12；日随年月联动钳制。
- 保存格式 "YYYY-MM-DD"，走 `clientAuthApi.updateProfile(token, { birth })` 老接口。

### Task 1: 生日选择纯函数（TDD）

**Files:** Create `src/features/mine/utils/birthday-columns.ts` + test

**Interfaces:**
```ts
daysInMonth(year, month): number
buildBirthdayColumns(today: Date): { years: number[]; months: number[]; currentYear: number }
clampDay(year, month, day): number
parseBirth(birth?: string | null, fallback: {y,m,d}): {y,m,d}
formatBirth(y, m, d): string // YYYY-MM-DD
```
- 测试：闰月天数（2024-2=29、2023-2=28）、年份范围长度 101、钳日（1月31→2月→28/29）、parse 非法输入回退 fallback。

- [ ] 实现并测试通过 + Commit `feat: 生日滚轮选择纯函数`

### Task 2: 滚轮弹层组件 + 接线

**Files:**
- Create: `src/features/mine/components/BirthDatePickerSheet.tsx`（三列 ScrollView snapToInterval 46，初始定位选中项，settle 更新选中，颜色按距离三档）
- Modify: `EditProfileScreen.tsx`（birth 行 label 改"生日"、值显示 birth/请选择生日；点击打开弹层；确定→updateProfile({birth})→applyProfile；BottomSheet 移除 birth 分支）

- [ ] 实现 + tsc + lint + 全量 vitest
- [ ] Commit `feat: 编辑资料生日滚轮选择弹层`
