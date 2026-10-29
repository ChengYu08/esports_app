# 俱乐部卡片游戏图标行实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 俱乐部卡片 meta 行右端渲染游戏图标（16×16 圆形）：≤4 个平铺；>4 个重叠且总宽不超过 4 个平铺宽度；最多展示 8 个。

**Spec:** Figma 1110-91547（图标 16×16 圆形，平铺步长 16，位于 人数/ID 同排右端）；用户规则三条。

## Global Constraints

- 布局为纯函数（TDD）；重叠时右侧图标在上层；不做设计稿之外的描边。

### Task: 实现

**Files:** Create `src/features/mine/utils/game-icons-layout.ts` + test；Modify `ClubCard.tsx`（metaRow 右端渲染游戏图标）。

**Interfaces:**
```ts
computeGameIconLayout(count: number, iconSize = 16, maxTotalWidth = 64): { shown: number; step: number; totalWidth: number }
```
- count≤4 → 平铺 step=iconSize；4<count≤8 → step=(maxTotalWidth-iconSize)/(count-1)；count>8 → shown=8 同式。

- [ ] 失败测试（count 1/3/4/5/8/9）→ 实现 → 通过 → ClubCard 渲染 → tsc/lint/vitest → 交付（不提交，等指示）
