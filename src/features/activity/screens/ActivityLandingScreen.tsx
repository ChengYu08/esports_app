import ActivityShell from "@/features/activity/shell/ActivityShell";
import { resolveActivityTheme } from "@/features/activity/themes/registry";

/** 活动落地页：按 activityCode 解析 Theme，交给极简 Shell。 */
export default function ActivityLandingScreen({ activityCode }: { activityCode: string }) {
  const Theme = resolveActivityTheme(activityCode);
  return <ActivityShell activityCode={activityCode} Theme={Theme} />;
}
