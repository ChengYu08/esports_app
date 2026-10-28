/**
 * 把裁剪页屏幕上的圆形区域映射回原图像素坐标。
 *
 * 图片在容器内以 scale（容器像素/原图像素）显示，未偏移时居中；
 * offsetX/offsetY 为相对居中位置的平移（容器像素）。
 * 裁剪框是圆直径所在的正方形，返回值已取整并 clamp 进图界。
 */
export function computeAvatarCropRect(input: {
  imageWidth: number;
  imageHeight: number;
  /** 裁剪视口边长（屏宽），圆形内切其中 */
  containerSize: number;
  /** 圆直径 / 容器边长，设计稿为 295/375 */
  circleRatio: number;
  /** 实际显示比例 = cover 基准 × zoom */
  scale: number;
  offsetX: number;
  offsetY: number;
}): { originX: number; originY: number; size: number } {
  const { imageWidth, imageHeight, containerSize, circleRatio, scale } = input;
  const circleSize = containerSize * circleRatio;
  const circleLeft = (containerSize - circleSize) / 2;

  const imageLeft = (containerSize - imageWidth * scale) / 2 + input.offsetX;
  const imageTop = (containerSize - imageHeight * scale) / 2 + input.offsetY;

  const size = Math.round(circleSize / scale);
  const originX = Math.round((circleLeft - imageLeft) / scale);
  const originY = Math.round((circleLeft - imageTop) / scale);

  const clamp = (value: number, max: number): number =>
    Math.min(Math.max(0, value), Math.max(0, max));

  return {
    originX: clamp(originX, imageWidth - size),
    originY: clamp(originY, imageHeight - size),
    size,
  };
}

/**
 * 钳制裁剪页图片的平移量：图片任何时刻必须完全覆盖视口（无空隙）。
 * displayedWidth/Height 为当前缩放下的图片显示尺寸（容器像素）。
 * 某一轴无溢出（显示尺寸小于视口）时该轴钳为 0 并保持居中。
 */
export function clampAvatarPan(input: {
  offsetX: number;
  offsetY: number;
  displayedWidth: number;
  displayedHeight: number;
  containerSize: number;
}): { offsetX: number; offsetY: number } {
  const { offsetX, offsetY, displayedWidth, displayedHeight, containerSize } =
    input;
  const maxX = Math.max(0, (displayedWidth - containerSize) / 2);
  const maxY = Math.max(0, (displayedHeight - containerSize) / 2);
  return {
    offsetX: Math.min(Math.max(-maxX, offsetX), maxX),
    offsetY: Math.min(Math.max(-maxY, offsetY), maxY),
  };
}
