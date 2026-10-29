import { describe, expect, it } from "vitest";

import {
  clampAvatarPan,
  computeAvatarCropRect,
} from "./avatar-crop";

const CONTAINER = 375;
const CIRCLE_RATIO = 295 / 375;

describe("computeAvatarCropRect", () => {
  it("方图 cover 且 zoom=1 时裁剪框为居中正方形", () => {
    const rect = computeAvatarCropRect({
      imageWidth: 600,
      imageHeight: 600,
      containerSize: CONTAINER,
      circleRatio: CIRCLE_RATIO,
      scale: 375 / 600,
      offsetX: 0,
      offsetY: 0,
    });
    // 圆左 = (375-295)/2 = 40；origin = 40/0.625 = 64；size = 295/0.625 = 472
    expect(rect).toEqual({ originX: 64, originY: 64, size: 472 });
  });

  it("竖图 cover 居中时映射回原图中部方块", () => {
    const rect = computeAvatarCropRect({
      imageWidth: 1080,
      imageHeight: 1920,
      containerSize: CONTAINER,
      circleRatio: CIRCLE_RATIO,
      scale: 375 / 1080,
      offsetX: 0,
      offsetY: 0,
    });
    expect(rect).toEqual({ originX: 115, originY: 535, size: 850 });
  });

  it("平移超界时 clamp 进图界，不产生负坐标或越界", () => {
    const rect = computeAvatarCropRect({
      imageWidth: 1080,
      imageHeight: 1920,
      containerSize: CONTAINER,
      circleRatio: CIRCLE_RATIO,
      scale: 375 / 1080,
      offsetX: 400,
      offsetY: 400,
    });
    expect(rect.originX).toBe(0);
    expect(rect.originY).toBe(0);
    expect(rect.size).toBe(850);
    expect(rect.originX + rect.size).toBeLessThanOrEqual(1080);
    expect(rect.originY + rect.size).toBeLessThanOrEqual(1920);
  });
});

describe("clampAvatarPan", () => {
  it("横图 zoom=1 时纵向无余量，平移钳为 0（不可露出空隙）", () => {
    // 4000×3000 在 375 视口 cover 后显示 375×281.25，纵向被视口裁剪
    const clamped = clampAvatarPan({
      offsetX: 0,
      offsetY: 30,
      displayedWidth: 375,
      displayedHeight: 281.25,
      containerSize: 375,
    });
    expect(clamped.offsetX).toBe(0);
    expect(clamped.offsetY).toBe(0);
  });

  it("竖图 zoom=1 时横向钳为 0、纵向可在余量内拖动选构图", () => {
    // 1080×1920 cover 后显示 375×666.67，纵向余量 ±145.83
    const clamped = clampAvatarPan({
      offsetX: 0,
      offsetY: 400,
      displayedWidth: 375,
      displayedHeight: 1920 / (1080 / 375),
      containerSize: 375,
    });
    expect(clamped.offsetX).toBe(0);
    expect(clamped.offsetY).toBeCloseTo(145.8333, 3);
  });

  it("zoom=2 的方图平移限制在溢出量的一半以内", () => {
    // 600×600 zoom=2 显示 750×750，余量 ±187.5
    const within = clampAvatarPan({
      offsetX: 100,
      offsetY: -100,
      displayedWidth: 750,
      displayedHeight: 750,
      containerSize: 375,
    });
    expect(within.offsetX).toBe(100);
    expect(within.offsetY).toBe(-100);

    const beyond = clampAvatarPan({
      offsetX: 500,
      offsetY: -500,
      displayedWidth: 750,
      displayedHeight: 750,
      containerSize: 375,
    });
    expect(beyond.offsetX).toBe(187.5);
    expect(beyond.offsetY).toBe(-187.5);
  });
});
