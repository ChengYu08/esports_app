import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { fetchHomeBroadcasts, fetchHomeHighlightClubs, fetchHomeHighlightRanking } from "../api/home-highlights.api";

export function useHomeHighlights(visible: boolean) {
  const [appState, setAppState] = useState(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);
  const active = visible && appState === "active";
  const broadcasts = useQuery({
    queryKey: ["home-highlights", "broadcasts"],
    queryFn: ({ signal }) => fetchHomeBroadcasts(signal),
    enabled: active,
    // 回到首页或前台时立即更新，停留期间每半分钟查询；三秒轮播只消费本地队列。
    staleTime: 0,
    refetchInterval: active ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
  const ranking = useQuery({
    queryKey: ["home-highlights", "weekly-ranking"],
    queryFn: ({ signal }) => fetchHomeHighlightRanking(signal),
    enabled: active,
  });
  const clubs = useQuery({
    queryKey: ["home-highlights", "clubs"],
    queryFn: ({ signal }) => fetchHomeHighlightClubs(signal),
    enabled: active,
  });
  return { broadcasts, ranking, clubs, active };
}

export type HomeHighlightsState = ReturnType<typeof useHomeHighlights>;
