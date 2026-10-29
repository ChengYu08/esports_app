/**
 * 俱乐部卡片游戏图标行的布局计算：
 * - ≤4 个：按设计稿平铺（步长 = 图标尺寸）；
 * - >4 个：重叠展示，总宽不超过 4 个平铺的宽度（64）；
 * - 最多展示 8 个，超出的不渲染。
 */
export function computeGameIconLayout(
  count: number,
  iconSize = 16,
  maxTotalWidth = iconSize * 4,
): { shown: number; step: number; totalWidth: number } {
  if (count <= 4) {
    return {
      shown: count,
      step: iconSize,
      totalWidth: count * iconSize,
    };
  }
  const shown = Math.min(count, 8);
  const step = (maxTotalWidth - iconSize) / (shown - 1);
  return {
    shown,
    step,
    totalWidth: maxTotalWidth,
  };
}
