import { describe, expect, it } from "vitest";

import { computeAvatarCropRect } from "./avatar-crop";

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
