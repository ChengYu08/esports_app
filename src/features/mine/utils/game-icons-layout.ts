/**
 * 俱乐部卡片游戏图标行的布局计算（设计稿 1110-91547）：
 * - 平铺，步长 16（图标渲染 14，圆形留白形成约 2px 视觉间距）；
 * - 最多展示 3 个，超出的不渲染，总宽不超过 48。
 */
export const GAME_ICON_SIZE = 14;
export const GAME_ICON_PITCH = 16;
export const GAME_ICONS_MAX_SHOWN = 3;

export function computeGameIconLayout(count: number): {
  shown: number;
  step: number;
  totalWidth: number;
} {
  const shown = Math.min(count, GAME_ICONS_MAX_SHOWN);
  return {
    shown,
    step: GAME_ICON_PITCH,
    totalWidth: GAME_ICON_PITCH * shown,
  };
}
