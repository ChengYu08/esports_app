import { describe, expect, it } from "vitest";

import { fitContainSize, popupViewportSize } from "./home-popup-layout";

describe("fitContainSize", () => {
  it("横图按宽度适配", () => {
    expect(fitContainSize(800, 400, 400, 400)).toEqual({ width: 400, height: 200 });
  });

  it("竖图按高度适配", () => {
    expect(fitContainSize(400, 800, 400, 400)).toEqual({ width: 200, height: 400 });
  });

  it("非法尺寸返回 0", () => {
    expect(fitContainSize(0, 100, 400, 400)).toEqual({ width: 0, height: 0 });
  });
});

describe("popupViewportSize", () => {
  it("取多图 fit 后的最大宽高", () => {
    expect(
      popupViewportSize(
        [
          { width: 300, height: 100 },
          { width: 200, height: 250 },
        ],
        400,
        400,
      ),
    ).toEqual({ width: 300, height: 250 });
  });

  it("超出 max 框时二次缩放", () => {
    expect(
      popupViewportSize(
        [
          { width: 500, height: 200 },
          { width: 300, height: 450 },
        ],
        400,
        400,
      ),
    ).toEqual(fitContainSize(500, 450, 400, 400));
  });
});
