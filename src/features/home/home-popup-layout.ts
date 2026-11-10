/** 开屏弹窗图片在最大框内 contain 适配后的尺寸。 */
export function fitContainSize(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (
    !(naturalWidth > 0) ||
    !(naturalHeight > 0) ||
    !(maxWidth > 0) ||
    !(maxHeight > 0)
  ) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight);
  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
  };
}

/**
 * 多图统一视口：对各图 fit 后取最大宽高，再若超出 max 框则整体二次缩放。
 */
export function popupViewportSize(
  fittedSizes: { width: number; height: number }[],
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (fittedSizes.length === 0 || !(maxWidth > 0) || !(maxHeight > 0)) {
    return { width: 0, height: 0 };
  }
  let width = 0;
  let height = 0;
  for (const size of fittedSizes) {
    width = Math.max(width, size.width);
    height = Math.max(height, size.height);
  }
  if (width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }
  return fitContainSize(width, height, maxWidth, maxHeight);
}
