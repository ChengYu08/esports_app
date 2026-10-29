/**
 * 俱乐部卡片游戏图标行的布局计算（设计稿 1110-91547）：
 * - ≤3 个：平铺，步长 16（图标渲染 14，圆形留白形成约 2px 视觉间距）；
 * - >3 个：重叠展示，总宽不超过 3 个平铺的宽度（48）；
 * - 最多展示 8 个，超出的不渲染。
 */
export const GAME_ICON_SIZE = 14;
export const GAME_ICON_PITCH = 16;
export const GAME_ICONS_MAX_SHOWN = 8;
export const GAME_ICONS_FLAT_COUNT = 3;

export function computeGameIconLayout(count: number): {
  shown: number;
  step: number;
  totalWidth: number;
} {
  if (count <= GAME_ICONS_FLAT_COUNT) {
    return {
      shown: count,
      step: GAME_ICON_PITCH,
      totalWidth: GAME_ICON_PITCH * count,
    };
  }
  const shown = Math.min(count, GAME_ICONS_MAX_SHOWN);
  const maxTotalWidth = GAME_ICON_PITCH * GAME_ICONS_FLAT_COUNT; // 48
  const step = (maxTotalWidth - GAME_ICON_SIZE) / (shown - 1);
  return { shown, step, totalWidth: maxTotalWidth };
}
