import type { ActivityThemeComponent } from "@/features/activity/themes/types";

import SeckillLandingView from "./seckill/SeckillLandingView";

const ACTIVITY_THEME_REGISTRY: Record<string, ActivityThemeComponent> = {
  ESPORTS_2026_SECKILL: SeckillLandingView,
};

/** 按 activityCode 解析活动 Theme；未注册返回 null。 */
export function resolveActivityTheme(activityCode: string): ActivityThemeComponent | null {
  const code = activityCode.trim();
  if (!code) {
    return null;
  }
  return ACTIVITY_THEME_REGISTRY[code] ?? null;
}
