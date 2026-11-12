import { useIsFocused } from "expo-router";

import type { QuickMatchGrabItem } from "@/features/match/api/match.types";
import { useProfileDetail } from "@/features/mine/hooks/use-profile-data";

/** 选人页每次进入或重新聚焦时拉取最新资料，保留缓存用于即时展示。 */
export function useMatchCandidateProfile(item: QuickMatchGrabItem) {
  const focused = useIsFocused();
  return useProfileDetail(
    item.companionUserId
      ? { userId: item.companionUserId, clubId: item.clubId }
      : null,
    focused,
    { staleTime: 0 },
  );
}
