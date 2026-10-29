import { describe, expect, it } from "vitest";

import { computeGameIconLayout } from "./game-icons-layout";

const ICON = 16;
const MAX_WIDTH = ICON * 4; // 设计稿：4 个平铺的总宽 64

describe("computeGameIconLayout", () => {
  it("count≤4 时平铺，步长等于图标尺寸", () => {
    expect(computeGameIconLayout(1, ICON, MAX_WIDTH)).toEqual({
      shown: 1,
      step: 16,
      totalWidth: 16,
    });
    expect(computeGameIconLayout(3, ICON, MAX_WIDTH)).toEqual({
      shown: 3,
      step: 16,
      totalWidth: 48,
    });
    expect(computeGameIconLayout(4, ICON, MAX_WIDTH)).toEqual({
      shown: 4,
      step: 16,
      totalWidth: 64,
    });
  });

  it("count=5 时开始重叠，总宽仍为 64", () => {
    const layout = computeGameIconLayout(5, ICON, MAX_WIDTH);
    expect(layout.shown).toBe(5);
    expect(layout.step).toBeCloseTo(12);
    expect(layout.totalWidth).toBe(64);
  });

  it("count=8 时步长收缩到 48/7，总宽不变", () => {
    const layout = computeGameIconLayout(8, ICON, MAX_WIDTH);
    expect(layout.shown).toBe(8);
    expect(layout.step).toBeCloseTo(48 / 7, 5);
    expect(layout.totalWidth).toBe(64);
  });

  it("count>8 只展示 8 个", () => {
    const layout = computeGameIconLayout(20, ICON, MAX_WIDTH);
    expect(layout.shown).toBe(8);
    expect(layout.step).toBeCloseTo(48 / 7, 5);
    expect(layout.totalWidth).toBe(64);
  });
});
