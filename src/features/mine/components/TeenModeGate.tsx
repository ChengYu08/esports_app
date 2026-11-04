import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "@esports/auth";

import TeenModeScreen from "@/features/mine/screens/TeenModeScreen";
import { TeenModePromoDialog } from "@/features/mine/components/TeenModePromoDialog";
import { teenModeApi, fetchTeenModeConfig } from "@/features/mine/api/teen-mode.api";
import type { TeenModeStatus } from "@/features/mine/api/teen-mode.contract";
import {
  readLastTeenEnabled,
  saveLastTeenEnabled,
  readTeenPopupCache,
  saveTeenPopupCache,
  subscribeTeenModeStatus,
} from "@/features/mine/teen-mode-store";
import {
  createTeenRequestGuard,
  type TeenRequestSnapshot,
} from "@/features/mine/teen-request-guard";
import {
  shouldShowTeenPopup,
  todayString,
} from "@/features/mine/utils/teen-popup";
import {
  DEFAULT_TEEN_LOCK_WINDOW,
  createTeenServerClock,
  msUntilTeenLockBoundary,
  readTeenServerClock,
  shouldLockTeenMode,
  type TeenLockWindow,
  type TeenServerClock,
} from "@/features/mine/utils/teen-lock-window";

/**
 * 青少年模式启动门：
 * - 联网状态用 serverTime + 单调时钟判定锁定时段（窗口随 /youth/config 服务端配置下发，默认 22:00-次日6:00），
 *   改设备时间不影响结果；
 * - 已开启账号离线或尚未取得可信时间时直接锁定，不退回设备时间；
 * - 缓存、状态请求和锁定页回调均校验登录会话，换号后旧结果不能落地。
 */
export function TeenModeGate() {
  const token = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const accountKey = token ? `${token}:${userId ?? ""}` : "";
  return (
    <TeenModeGateSession
      key={accountKey}
      token={token}
      userId={userId}
    />
  );
}

function TeenModeGateSession({
  token,
  userId,
}: {
  token: string | null;
  userId: string | null;
}) {
  const [status, setStatus] = useState<TeenModeStatus | null>(null);
  const [cachedEnabled, setCachedEnabled] = useState(false);
  const [cacheReady, setCacheReady] = useState(!token);
  const [promoVisible, setPromoVisible] = useState(false);
  const [serverNow, setServerNow] = useState<number | null>(null);
  const [lockWindow, setLockWindow] = useState<TeenLockWindow>(DEFAULT_TEEN_LOCK_WINDOW);
  const serverClockRef = useRef<TeenServerClock | null>(null);
  const requestGuardRef = useRef(createTeenRequestGuard());
  const statusSyncedRef = useRef(false);
  const refreshOnActiveRef = useRef<(() => void) | null>(null);
  const reevaluateClockRef = useRef<(() => void) | null>(null);
  const inFlightSnapshotRef = useRef<TeenRequestSnapshot | null>(null);

  const calibratedNow = () => {
    const clock = serverClockRef.current;
    if (!clock) {
      return null;
    }
    return readTeenServerClock(clock, performance.now());
  };

  const applyStatus = (
    next: TeenModeStatus,
    expectedSession: number,
    targetUserId: string | null,
  ) => {
    if (!requestGuardRef.current.isSessionCurrent(expectedSession)) {
      return false;
    }
    statusSyncedRef.current = true;
    setStatus(next);
    setCachedEnabled(next.enabled);
    setCacheReady(true);
    if (typeof next.serverTime === "number" && Number.isFinite(next.serverTime)) {
      serverClockRef.current = createTeenServerClock(
        next.serverTime,
        performance.now(),
      );
    } else {
      serverClockRef.current = null;
    }
    setServerNow(calibratedNow());
    reevaluateClockRef.current?.();
    void saveLastTeenEnabled(next.enabled, targetUserId);
    return true;
  };

  useEffect(() => {
    const guard = requestGuardRef.current;
    const session = guard.beginSession();
    const targetToken = token;
    const targetUserId = userId;
    inFlightSnapshotRef.current = null;
    statusSyncedRef.current = false;
    serverClockRef.current = null;
    refreshOnActiveRef.current = null;

    if (!targetToken) {
      return;
    }

    const unsubscribeStatus = subscribeTeenModeStatus((next, changedToken) => {
      if (
        changedToken !== targetToken
        || !guard.isSessionCurrent(session)
      ) {
        return;
      }
      guard.invalidateStatus();
      applyStatus(next, session, targetUserId);
    });

    // 锁定窗口跟随服务端配置（/youth/config，Nacos 动态下发）；失败回退默认 22:00-次日6:00
    void (async () => {
      try {
        const config = await fetchTeenModeConfig(targetToken);
        const startHour = Number(config?.lockStartHour);
        const endHour = Number(config?.lockEndHour);
        if (!guard.isSessionCurrent(session)) {
          return;
        }
        if (
          Number.isInteger(startHour) && startHour >= 0 && startHour <= 23
          && Number.isInteger(endHour) && endHour >= 0 && endHour <= 23
        ) {
          setLockWindow({ startHour, endHour });
        }
      } catch {
        // 配置拉取失败保持默认窗口：与服务端默认配置一致，服务端兜底拦截仍生效
      }
    })();

    const runFetch = async (allowPromo: boolean) => {
      if (inFlightSnapshotRef.current) {
        return;
      }
      const snapshot = guard.snapshot();
      inFlightSnapshotRef.current = snapshot;
      try {
        const next = await teenModeApi.status(targetToken);
        if (!guard.isCurrent(snapshot)) {
          return;
        }
        if (!applyStatus(next, session, targetUserId)) {
          return;
        }
        if (allowPromo && !next.enabled) {
          const cache = await readTeenPopupCache();
          if (guard.isCurrent(snapshot)) {
            setPromoVisible(shouldShowTeenPopup(cache, todayString()));
          }
        }
      } catch {
        // 缓存已开启或时间不可信时由渲染层保持锁定；从未同步账号仍按原规则放行。
      } finally {
        if (inFlightSnapshotRef.current === snapshot) {
          inFlightSnapshotRef.current = null;
        }
      }
    };

    refreshOnActiveRef.current = () => {
      void runFetch(false);
    };

    void (async () => {
      try {
        const enabled = await readLastTeenEnabled(targetUserId);
        if (!guard.isSessionCurrent(session) || statusSyncedRef.current) {
          return;
        }
        // 登录用户ID未知时不能使用全局镜像，也无法证明未开启，先保守锁定。
        setCachedEnabled(enabled === true || !targetUserId);
        setServerNow(null);
      } catch {
        if (guard.isSessionCurrent(session) && !statusSyncedRef.current) {
          // 存储不可读时无法证明未开启，保守锁定直到服务端状态返回。
          setCachedEnabled(true);
          setServerNow(null);
        }
      } finally {
        if (guard.isSessionCurrent(session)) {
          setCacheReady(true);
        }
      }
    })();

    void runFetch(true);
    return () => {
      unsubscribeStatus();
      if (guard.isSessionCurrent(session)) {
        guard.beginSession();
      }
      refreshOnActiveRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId]);

  useEffect(() => {
    if (!token) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const evaluate = () => {
      if (timer) {
        clearTimeout(timer);
      }
      const now = calibratedNow();
      setServerNow(now);
      timer = setTimeout(
        evaluate,
        now === null
          ? 60_000
          : msUntilTeenLockBoundary(now, lockWindow.startHour, lockWindow.endHour),
      );
    };
    reevaluateClockRef.current = evaluate;
    evaluate();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        // 深睡眠可能暂停单调时钟，回前台必须作废旧响应并重新校准。
        requestGuardRef.current.invalidateStatus();
        inFlightSnapshotRef.current = null;
        serverClockRef.current = null;
        evaluate();
        refreshOnActiveRef.current?.();
      }
    });
    return () => {
      reevaluateClockRef.current = null;
      if (timer) {
        clearTimeout(timer);
      }
      subscription.remove();
    };
  }, [token, userId, lockWindow]);

  const handleStatusChanged = (next: TeenModeStatus) => {
    const session = requestGuardRef.current.snapshot().session;
    requestGuardRef.current.invalidateStatus();
    applyStatus(next, session, userId);
  };

  const dismissPromo = (dontAsk: boolean, goEnable: boolean) => {
    void saveTeenPopupCache({ lastDismissedDate: todayString(), dontAsk });
    setPromoVisible(false);
    if (goEnable) {
      router.push("/teen-mode");
    }
  };

  if (!token) {
    return null;
  }

  if (!cacheReady && !status) {
    return <View style={[StyleSheet.absoluteFill, styles.blocking]} />;
  }

  const effectiveEnabled = status?.enabled ?? cachedEnabled;
  if (shouldLockTeenMode(effectiveEnabled, serverNow, lockWindow)) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <TeenModeScreen
          locked
          onStatusChanged={handleStatusChanged}
        />
      </View>
    );
  }

  if (!promoVisible) {
    return null;
  }

  return (
    <TeenModePromoDialog
      visible
      onClose={(dontAsk) => dismissPromo(dontAsk, false)}
      onGoEnable={(dontAsk) => dismissPromo(dontAsk, true)}
    />
  );
}

const styles = StyleSheet.create({
  blocking: { backgroundColor: "#FFF" },
});
