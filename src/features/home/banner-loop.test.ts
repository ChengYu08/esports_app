import { describe, expect, it } from "vitest";

import { loopSnapOffset, toLogicalIndex, withLoopBuffers } from "./banner-loop";

describe("withLoopBuffers", () => {
  it("页数大于 1 时首尾各补一页缓冲", () => {
    expect(withLoopBuffers(["a", "b"])).toEqual(["b", "a", "b", "a"]);
    expect(withLoopBuffers(["a", "b", "c"])).toEqual(["c", "a", "b", "c", "a"]);
  });

  it("单页或空页时不加缓冲", () => {
    expect(withLoopBuffers(["a"])).toEqual(["a"]);
    expect(withLoopBuffers([])).toEqual([]);
  });
});

describe("toLogicalIndex", () => {
  it("物理页码映射回逻辑页码并循环取模", () => {
    expect(toLogicalIndex(1, 2)).toBe(0);
    expect(toLogicalIndex(2, 2)).toBe(1);
    expect(toLogicalIndex(0, 2)).toBe(1);
    expect(toLogicalIndex(3, 2)).toBe(0);
  });

  it("单页时原样返回", () => {
    expect(toLogicalIndex(0, 1)).toBe(0);
  });
});

describe("loopSnapOffset", () => {
  it("滑入尾缓冲页跳回首张真实页", () => {
    expect(loopSnapOffset(3, 2, 100)).toBe(100);
  });

  it("滑入首缓冲页跳回末张真实页", () => {
    expect(loopSnapOffset(0, 2, 100)).toBe(200);
  });

  it("真实页上不需要跳转", () => {
    expect(loopSnapOffset(1, 2, 100)).toBeNull();
    expect(loopSnapOffset(2, 2, 100)).toBeNull();
  });

  it("单页时不参与循环", () => {
    expect(loopSnapOffset(0, 1, 100)).toBeNull();
  });
});
