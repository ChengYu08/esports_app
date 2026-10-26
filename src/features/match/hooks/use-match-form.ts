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
  MatchGame,
  MatchGenderRequirement,
  MatchLevel,
  MatchMode,
  MatchService,
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

/** 备注字数上限，对齐 PC ClubQuickMatchModal */
export const MATCH_REMARK_MAX = 200;

const EMPTY_GAMES: MatchGame[] = [];
const EMPTY_CLUBS: MatchClub[] = [];
const EMPTY_MODES: MatchMode[] = [];
const EMPTY_LEVELS: MatchLevel[] = [];
const EMPTY_SERVICES: MatchService[] = [];

export const quickMatchGamesQueryKey = (token: string) =>
  ["quick-match", "games", token] as const;

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

export type UseMatchFormOptions = {
  /** 为 false 时不发起级联查询（弹层关闭时避免后台请求） */
  enabled?: boolean;
  /**
   * 俱乐部主页场景：固定俱乐部，不拉俱乐部列表；
   * 切换游戏时保持该俱乐部（无需出现在 getQuickMatchClubList 中）。
   */
  lockedClub?: Pick<MatchClub, "id" | "name"> | null;
  /**
   * 外部传入的游戏列表（如俱乐部详情 clubGames）。
   * 传入后跳过 getQuickMatchGameList，不影响平台发布页默认拉全量。
   */
  providedGames?: MatchGame[] | null;
};

export function useMatchForm(options: UseMatchFormOptions = {}) {
  const enabled = options.enabled !== false;
  const lockedClub = options.lockedClub ?? null;
  const clubLockedMode = Boolean(lockedClub);
  const providedGames = options.providedGames ?? null;
  const hasProvidedGames = providedGames !== null;
  const token = useAuthStore((state) => state.accessToken);

  const [gameId, setGameId] = useState<string | null>(null);
  const [selectedClub, setSelectedClub] = useState<MatchClub | null>(null);
  const [modeId, setModeId] = useState<string | null>(null);
  const [levelId, setLevelId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [gender, setGender] = useState<MatchGenderRequirement>(0);
  const [companionPreference, setCompanionPreference] =
    useState<MatchCompanionPreference | null>(1);
  const [quantity, setQuantity] = useState(1);
  const [voice, setVoice] = useState<MatchVoiceOption>("不试音");
  const [remark, setRemark] = useState("");

  // 弹层关闭时清空选择，避免下次打开带着旧 gameId 先打一枪再被 bootstrap 改掉（双请求）
  useEffect(() => {
    if (enabled) return;
    setGameId(null);
    setSelectedClub(null);
    setModeId(null);
    setLevelId(null);
    setServiceId(null);
    setGender(0);
    setCompanionPreference(1);
    setQuantity(1);
    setVoice("不试音");
    setRemark("");
  }, [enabled]);

  // 俱乐部锁定场景直接使用外部俱乐部，避免 state 先清空再由 effect 恢复。
  const club = lockedClub ?? selectedClub;

  const gamesQuery = useQuery({
    queryKey: quickMatchGamesQueryKey(token as string),
    queryFn: ({ signal }) => fetchQuickMatchGames(token as string, signal),
    enabled: enabled && Boolean(token) && !hasProvidedGames,
  });

  const clubsQuery = useQuery({
    queryKey: ["quick-match", "clubs", token, gameId],
    queryFn: ({ signal }) => fetchQuickMatchClubs(gameId as string, token as string, signal),
    enabled: enabled && !clubLockedMode && Boolean(token && gameId),
  });

  const modesQuery = useQuery({
    queryKey: ["quick-match", "modes", token, club?.id, gameId],
    queryFn: ({ signal }) =>
      fetchClubGameModes(club!.id, gameId as string, token as string, signal),
    enabled: enabled && Boolean(token && club?.id && gameId),
  });

  const levelsQuery = useQuery({
    queryKey: ["quick-match", "levels", token, modeId],
    queryFn: ({ signal }) => fetchClubGameLevels(modeId as string, token as string, signal),
    enabled: enabled && Boolean(token && modeId),
  });

  const servicesQuery = useQuery({
    queryKey: ["quick-match", "services", token, levelId],
    queryFn: ({ signal }) => fetchClubGameServices(levelId as string, token as string, signal),
    enabled: enabled && Boolean(token && levelId),
  });

  const games = providedGames ?? gamesQuery.data ?? EMPTY_GAMES;
  const clubs = clubsQuery.data ?? EMPTY_CLUBS;
  const modes = modesQuery.data ?? EMPTY_MODES;
  const levels = levelsQuery.data ?? EMPTY_LEVELS;
  const services = servicesQuery.data ?? EMPTY_SERVICES;

  const selectedService = useMemo(
    () => services.find((item) => item.id === serviceId) ?? null,
    [serviceId, services],
  );

  const showCompanionPreference = Boolean(
    selectedService && !selectedService.supportMultiCompanion,
  );

  // 游戏列表加载后默认选中第一项
  useEffect(() => {
    if (!enabled) return;
    if (!gameId && games.length > 0) {
      setGameId(games[0].id);
    }
  }, [enabled, gameId, games]);

  // 俱乐部列表变化时，若当前俱乐部不在列表中则清空（平台选俱乐部模式）
  useEffect(() => {
    if (clubLockedMode) return;
    if (!club) return;
    if (clubsQuery.isFetching) return;
    if (!clubs.some((item) => item.id === club.id)) {
      setSelectedClub(null);
      setModeId(null);
      setLevelId(null);
      setServiceId(null);
      setCompanionPreference(1);
    }
  }, [clubLockedMode, club, clubs, clubsQuery.isFetching]);

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
    if (!clubLockedMode) {
      setSelectedClub(null);
    }
    setModeId(null);
    setLevelId(null);
    setServiceId(null);
    setGender(0);
    setCompanionPreference(1);
  }, [clubLockedMode]);

  const selectClub = useCallback((nextClub: MatchClub) => {
    setSelectedClub(nextClub);
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

  const remarkOverLimit = remark.length > MATCH_REMARK_MAX;

  const updateRemark = useCallback((next: string) => {
    setRemark(next.slice(0, MATCH_REMARK_MAX + 1));
  }, []);

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
    remarkOverLimit,
    games,
    clubs,
    modes,
    levels,
    services,
    selectedService,
    showCompanionPreference,
    estimatedPriceText,
    gamesLoading: hasProvidedGames ? false : gamesQuery.isLoading,
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
    setRemark: updateRemark,
  };
}
