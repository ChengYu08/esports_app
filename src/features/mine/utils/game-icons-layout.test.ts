import { describe, expect, it } from "vitest";

import { computeGameIconLayout } from "./game-icons-layout";

describe("computeGameIconLayout", () => {
  it("count≤3 平铺：步长 16，总宽 16×count", () => {
    expect(computeGameIconLayout(1)).toEqual({ shown: 1, step: 16, totalWidth: 16 });
    expect(computeGameIconLayout(3)).toEqual({ shown: 3, step: 16, totalWidth: 48 });
  });

  it.each([4, 8, 20])("count=%i 只展示 3 个且保持平铺", (count) => {
    expect(computeGameIconLayout(count)).toEqual({
      shown: 3,
      step: 16,
      totalWidth: 48,
    });
  });

  it("count=0 返回空布局", () => {
    expect(computeGameIconLayout(0)).toEqual({ shown: 0, step: 16, totalWidth: 0 });
  });
});
