import { useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchClubOnlineCount } from "@/features/home/api/home.api";
import type { Club } from "@/features/home/api/home.types";

const ONLINE_COUNT_BATCH_SIZE = 4;
const ONLINE_COUNT_BATCH_GAP_MS = 120;
const ONLINE_COUNT_STALE_TIME_MS = 30_000;
const ONLINE_COUNT_SETTLE_MS = 250;

type ClubOnlineCountQuery = {
  clubId: string;
  countedGames: number[];
  queryKey: readonly ["club-online-count", string, number[]];
};

function buildQueries(clubs: readonly Club[], gameIds?: readonly number[]): ClubOnlineCountQuery[] {
  const uniqueClubs = Array.from(new Map(clubs.map((club) => [club.id, club])).values());
  return uniqueClubs.map((club) => {
    const countedGames = Array.from(new Set(club.gameIds ?? []))
      .filter((id) => !gameIds || gameIds.includes(id))
      .sort((a, b) => a - b);
    return {
      clubId: club.id,
      countedGames,
      queryKey: ["club-online-count", club.id, countedGames] as const,
    };
  });
}

/** 俱乐部集合与游戏范围未变化时签名不变，避免列表刷新导致重复请求。 */
function buildSignature(queries: ClubOnlineCountQuery[]) {
  return queries.map((query) => `${query.clubId}:${query.countedGames.join(",")}`).join("|");
}

function readCachedCounts(
  queryClient: ReturnType<typeof useQueryClient>,
  queries: ClubOnlineCountQuery[],
) {
  const counts: Record<string, number> = {};
  for (const query of queries) {
    const data = queryClient.getQueryData<number>(query.queryKey);
    if (typeof data === "number") counts[query.clubId] = data;
  }
  return counts;
}

function sameCounts(current: Record<string, number>, next: Record<string, number>) {
  const currentKeys = Object.keys(current);
  if (currentKeys.length !== Object.keys(next).length) return false;
  return currentKeys.every((key) => current[key] === next[key]);
}

/**
 * 首页在线陪玩按当前游戏范围统计，返回首页或下拉刷新时同步重新查询。
 * 查询结果先落缓存，全部结束后统一写回一次，避免每个查询各自返回时触发整页重渲染。
 */
export function useClubOnlineCounts(clubs: readonly Club[], gameIds?: readonly number[], enabled = true) {
  const focused = useIsFocused();
  const queryClient = useQueryClient();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isRefetching, setIsRefetching] = useState(false);

  const queries = useMemo(() => buildQueries(clubs, gameIds), [clubs, gameIds]);
  const signature = useMemo(() => buildSignature(queries), [queries]);
  const queriesRef = useRef(queries);
  const runIdRef = useRef(0);
  useEffect(() => {
    queriesRef.current = queries;
  }, [queries]);

  const applyCounts = useCallback(() => {
    const next = readCachedCounts(queryClient, queriesRef.current);
    setCounts((current) => (sameCounts(current, next) ? current : next));
  }, [queryClient]);

  // 分批请求：每批结束后让出事件循环；自动聚焦复用 30 秒新鲜缓存，手动下拉仍强制刷新。
  const fetchAll = useCallback(async (force = false) => {
    const runId = ++runIdRef.current;
    const activeQueries = queriesRef.current;
    if (activeQueries.length === 0) return;
    if (force) {
      setIsRefetching(true);
    }
    try {
      for (let index = 0; index < activeQueries.length; index += ONLINE_COUNT_BATCH_SIZE) {
        if (runIdRef.current !== runId) return;
        const batch = activeQueries.slice(index, index + ONLINE_COUNT_BATCH_SIZE);
        await Promise.allSettled(
          batch.map((query) =>
            queryClient.fetchQuery({
              queryKey: query.queryKey,
              queryFn: ({ signal }) => fetchClubOnlineCount(query.clubId, query.countedGames, signal),
              staleTime: force ? 0 : ONLINE_COUNT_STALE_TIME_MS,
              retry: 1,
            }),
          ),
        );
        if (runIdRef.current !== runId) return;
        if (index + ONLINE_COUNT_BATCH_SIZE < activeQueries.length) {
          await new Promise((resolve) => setTimeout(resolve, ONLINE_COUNT_BATCH_GAP_MS));
        }
      }
    } finally {
      if (force && runIdRef.current === runId) {
        setIsRefetching(false);
      }
    }
  }, [queryClient]);

  useEffect(() => {
    if (!enabled || !focused) {
      return;
    }
    let cancelled = false;
    applyCounts();
    // 快速滑动时只等待最后一组可见卡片稳定后查询，避免为中途掠过的俱乐部反复启动请求。
    const timer = setTimeout(() => {
      fetchAll().then(() => {
        if (!cancelled) {
          applyCounts();
        }
      });
    }, ONLINE_COUNT_SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      // 离屏即作废旧代次并中止在途请求，避免多次往返后多个全量批次叠加。
      runIdRef.current += 1;
      void queryClient.cancelQueries({ queryKey: ["club-online-count"] });
    };
  }, [applyCounts, enabled, fetchAll, focused, queryClient, signature]);

  const refetch = useCallback(async () => {
    await fetchAll(true);
    applyCounts();
  }, [applyCounts, fetchAll]);

  return { counts, refetch, isRefetching };
}
