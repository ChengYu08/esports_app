import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";

import ActivityLandingScreen from "@/features/activity/screens/ActivityLandingScreen";
import { showToast } from "@/shared/ui/app-toast";

/** 通用活动落地页路由：/activity?activityCode=xxx（首页 Banner 按端协议进入）。 */
export default function ActivityRoute() {
  const params = useLocalSearchParams<{ activityCode?: string | string[] }>();
  const raw = Array.isArray(params.activityCode) ? params.activityCode[0] : params.activityCode;
  const activityCode = (raw || "").trim();

  // 缺参兜底：Toast 提示后返回，避免渲染空页面。
  useEffect(() => {
    if (activityCode) {
      return;
    }
    showToast("活动不存在或已下线");
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [activityCode]);

  if (!activityCode) {
    return null;
  }

  return <ActivityLandingScreen activityCode={activityCode} />;
}
