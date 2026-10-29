import { describe, expect, it } from "vitest";

import { computeGameIconLayout } from "./game-icons-layout";

describe("computeGameIconLayout", () => {
  it("count≤3 平铺：步长 16，总宽 16×count", () => {
    expect(computeGameIconLayout(1)).toEqual({ shown: 1, step: 16, totalWidth: 16 });
    expect(computeGameIconLayout(3)).toEqual({ shown: 3, step: 16, totalWidth: 48 });
  });

  it("count=4 开始重叠：步长 (48-14)/3≈11.33，总宽钳制 48", () => {
    const layout = computeGameIconLayout(4);
    expect(layout.shown).toBe(4);
    expect(layout.step).toBeCloseTo((48 - 14) / 3, 5);
    expect(layout.totalWidth).toBe(48);
  });

  it("count=8 步长收缩到 (48-14)/7，总宽不变", () => {
    const layout = computeGameIconLayout(8);
    expect(layout.shown).toBe(8);
    expect(layout.step).toBeCloseTo(34 / 7, 5);
    expect(layout.totalWidth).toBe(48);
  });

  it("count>8 只展示 8 个", () => {
    const layout = computeGameIconLayout(20);
    expect(layout.shown).toBe(8);
    expect(layout.totalWidth).toBe(48);
  });

  it("count=0 返回空布局", () => {
    expect(computeGameIconLayout(0)).toEqual({ shown: 0, step: 16, totalWidth: 0 });
  });
});
