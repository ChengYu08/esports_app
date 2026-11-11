import type { ComponentType } from "react";
import type { EdgeInsets } from "react-native-safe-area-context";

import type { ActivityDetail } from "@/features/activity/api/activity.types";

/** 活动 Theme 契约：Shell 只传详情与安全区，状态/倒计时/交互由 Theme 内聚。 */
export type ActivityThemeProps = {
  detail: ActivityDetail;
  insets: EdgeInsets;
  /** 顶部导航占用高度（含安全区）；导航为绝对定位时，Theme 内容需用此值避开。 */
  headerOffset: number;
};

export type ActivityThemeComponent = ComponentType<ActivityThemeProps>;
