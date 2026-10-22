import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@esports/auth";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchClubGameLevels,
  fetchClubGameModes,
  fetchClubGameServices,
  fetchQuickMatchClubs,
  fetchQuickMatchGames,
} from "@/features/match/api/match.api";
import type {
  MatchClub,
  MatchCompanionPreference,
  MatchGenderRequirement,
  MatchVoiceOption,
} from "@/features/match/api/match.types";

export const MATCH_GENDER_OPTIONS: { value: MatchGenderRequirement; label: string }[] = [
  { value: 0, label: "不限" },
  { value: 1, label: "男" },
  { value: 2, label: "女" },
];

export const MATCH_VOICE_OPTIONS: MatchVoiceOption[] = ["不试音", "需试音"];

export const MATCH_COMPANION_PREFERENCE_OPTIONS: {
  value: MatchCompanionPreference;
  label: string;
}[] = [
  { value: 1, label: "单陪" },
  { value: 2, label: "双陪" },
];

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(2)).toString();
}

function formatPriceRange(first: number, second: number): string {
  const min = Math.min(first, second);
  const max = Math.max(first, second);
  if (min === max) return formatPrice(min);
  return `${formatPrice(min)}~${formatPrice(max)}`;
}

export function useMatchForm() {
  const token = useAuthStore((state) => state.accessToken);

  const [gameId, setGameId] = useState<string | null>(null);
  const [club, setClub] = useState<MatchClub | null>(null);
  const [modeId, setModeId] = useState<string | null>(null);
  const [levelId, setLevelId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [gender, setGender] = useState<MatchGenderRequirement>(0);
  const [companionPreference, setCompanionPreference] =
    useState<MatchCompanionPreference | null>(1);
  const [quantity, setQuantity] = useState(1);
  const [voice, setVoice] = useState<MatchVoiceOption>("不试音");
  const [remark, setRemark] = useState("");

  const gamesQuery = useQuery({
    queryKey: ["quick-match", "games", token],
    queryFn: ({ signal }) => fetchQuickMatchGames(token as string, signal),
    enabled: Boolean(token),
  });

  const clubsQuery = useQuery({
    queryKey: ["quick-match", "clubs", token, gameId],
    queryFn: ({ signal }) => fetchQuickMatchClubs(gameId as string, token as string, signal),
    enabled: Boolean(token && gameId),
  });

  const modesQuery = useQuery({
    queryKey: ["quick-match", "modes", token, club?.id, gameId],
    queryFn: ({ signal }) =>
      fetchClubGameModes(club!.id, gameId as string, token as string, signal),
    enabled: Boolean(token && club?.id && gameId),
  });

  const levelsQuery = useQuery({
    queryKey: ["quick-match", "levels", token, modeId],
    queryFn: ({ signal }) => fetchClubGameLevels(modeId as string, token as string, signal),
    enabled: Boolean(token && modeId),
  });

  const servicesQuery = useQuery({
    queryKey: ["quick-match", "services", token, levelId],
    queryFn: ({ signal }) => fetchClubGameServices(levelId as string, token as string, signal),
    enabled: Boolean(token && levelId),
  });

  const games = gamesQuery.data ?? [];
  const clubs = clubsQuery.data ?? [];
  const modes = modesQuery.data ?? [];
  const levels = levelsQuery.data ?? [];
  const services = servicesQuery.data ?? [];

  const selectedService = useMemo(
    () => services.find((item) => item.id === serviceId) ?? null,
    [serviceId, services],
  );

  const showCompanionPreference = Boolean(
    selectedService && !selectedService.supportMultiCompanion,
  );

  // 游戏列表加载后默认选中第一项
  useEffect(() => {
    if (!gameId && games.length > 0) {
      setGameId(games[0].id);
    }
  }, [gameId, games]);

  // 俱乐部列表变化时，若当前俱乐部不在列表中则清空
  useEffect(() => {
    if (!club) return;
    if (clubsQuery.isFetching) return;
    if (!clubs.some((item) => item.id === club.id)) {
      setClub(null);
      setModeId(null);
      setLevelId(null);
      setServiceId(null);
      setCompanionPreference(1);
    }
  }, [club, clubs, clubsQuery.isFetching]);

  useEffect(() => {
    if (!modeId) return;
    if (modesQuery.isFetching) return;
    if (!modes.some((item) => item.id === modeId)) {
      setModeId(null);
      setLevelId(null);
      setServiceId(null);
      setCompanionPreference(1);
    }
  }, [modeId, modes, modesQuery.isFetching]);

  useEffect(() => {
    if (!levelId) return;
    if (levelsQuery.isFetching) return;
    if (!levels.some((item) => item.id === levelId)) {
      setLevelId(null);
      setServiceId(null);
      setCompanionPreference(1);
    }
  }, [levelId, levels, levelsQuery.isFetching]);

  useEffect(() => {
    if (!serviceId) return;
    if (servicesQuery.isFetching) return;
    if (!services.some((item) => item.id === serviceId)) {
      setServiceId(null);
      setCompanionPreference(1);
      return;
    }
    const svc = services.find((item) => item.id === serviceId);
    if (!svc) return;
    if (svc.supportMultiCompanion) {
      setCompanionPreference(null);
    } else if (companionPreference === null) {
      setCompanionPreference(1);
    }
  }, [companionPreference, serviceId, services, servicesQuery.isFetching]);

  const selectGame = useCallback((nextGameId: string) => {
    setGameId(nextGameId);
    setClub(null);
    setModeId(null);
    setLevelId(null);
    setServiceId(null);
    setGender(0);
    setCompanionPreference(1);
  }, []);

  const selectClub = useCallback((nextClub: MatchClub) => {
    setClub(nextClub);
    setModeId(null);
    setLevelId(null);
    setServiceId(null);
    setGender(0);
    setCompanionPreference(1);
  }, []);

  const selectMode = useCallback((nextModeId: string) => {
    setModeId(nextModeId);
    setLevelId(null);
    setServiceId(null);
    setGender(0);
    setCompanionPreference(1);
  }, []);

  const selectLevel = useCallback((nextLevelId: string) => {
    setLevelId(nextLevelId);
    setServiceId(null);
    setGender(0);
    setCompanionPreference(1);
  }, []);

  const selectService = useCallback(
    (nextServiceId: string) => {
      const svc = services.find((item) => item.id === nextServiceId);
      setServiceId(nextServiceId);
      setGender(0);
      if (svc?.supportMultiCompanion) {
        setCompanionPreference(null);
      } else {
        setCompanionPreference(1);
      }
    },
    [services],
  );

  const estimatedPriceText = useMemo(() => {
    if (!selectedService) return "--";
    const maleTotal = selectedService.malePrice * quantity;
    const femaleTotal = selectedService.femalePrice * quantity;
    if (gender === 1) return formatPrice(maleTotal);
    if (gender === 2) return formatPrice(femaleTotal);
    return formatPriceRange(maleTotal, femaleTotal);
  }, [gender, quantity, selectedService]);

  return {
    token,
    gameId,
    club,
    modeId,
    levelId,
    serviceId,
    gender,
    companionPreference,
    quantity,
    voice,
    remark,
    games,
    clubs,
    modes,
    levels,
    services,
    selectedService,
    showCompanionPreference,
    estimatedPriceText,
    gamesLoading: gamesQuery.isLoading,
    clubsLoading: clubsQuery.isLoading || clubsQuery.isFetching,
    modesLoading: modesQuery.isLoading || modesQuery.isFetching,
    levelsLoading: levelsQuery.isLoading || levelsQuery.isFetching,
    servicesLoading: servicesQuery.isLoading || servicesQuery.isFetching,
    selectGame,
    selectClub,
    selectMode,
    selectLevel,
    selectService,
    setGender,
    setCompanionPreference,
    setQuantity,
    setVoice,
    setRemark,
  };
}
