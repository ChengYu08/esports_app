import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";

import type { MatchGame } from "@/features/match/api/match.types";
import MatchMatchingScreen from "@/features/match/screens/MatchMatchingScreen";

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function MatchMatchingRoute() {
  const { requestNo, expireTime, gameId, gameName, gameIconUrl } =
    useLocalSearchParams<{
      requestNo: string;
      expireTime?: string;
      gameId?: string;
      gameName?: string;
      gameIconUrl?: string;
    }>();

  const resolvedRequestNo = firstParam(requestNo);
  const resolvedExpireTime = firstParam(expireTime);
  const game = useMemo((): MatchGame | null => {
    const id = firstParam(gameId);
    const name = firstParam(gameName);
    if (!id || !name) return null;
    const iconUrl = firstParam(gameIconUrl);
    return {
      id,
      name,
      ...(iconUrl ? { iconUrl } : {}),
    };
  }, [gameId, gameIconUrl, gameName]);

  if (!resolvedRequestNo) return null;

  return (
    <MatchMatchingScreen
      requestNo={resolvedRequestNo}
      expireTime={resolvedExpireTime || undefined}
      game={game}
    />
  );
}
