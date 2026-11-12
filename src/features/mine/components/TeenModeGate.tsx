import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "@esports/auth";

import TeenModeScreen from "@/features/mine/screens/TeenModeScreen";
import { TeenModePromoDialog } from "@/features/mine/components/TeenModePromoDialog";
import { teenModeApi } from "@/features/mine/api/teen-mode.api";
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

/**
 * 青少年模式启动门：
 * - 服务端状态 enabled=true 即全屏锁定覆盖，App 端不按时段判定（时段拦截由服务端执行）；
 *   开启成功后通过 teen-mode-store 同步广播立即出现覆盖层，无需重启；
 * - 解锁唯一途径是输入密码关闭（enabled=false）；
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
  const requestGuardRef = useRef(createTeenRequestGuard());
  const statusSyncedRef = useRef(false);
  const refreshOnActiveRef = useRef<(() => void) | null>(null);
  const inFlightSnapshotRef = useRef<TeenRequestSnapshot | null>(null);

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
        // 缓存已开启时由渲染层保持锁定；从未同步账号仍按原规则放行。
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
      } catch {
        if (guard.isSessionCurrent(session) && !statusSyncedRef.current) {
          // 存储不可读时无法证明未开启，保守锁定直到服务端状态返回。
          setCachedEnabled(true);
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
  }, [token, userId]);

  useEffect(() => {
    if (!token) {
      return;
    }
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        // 回前台作废旧响应并重新拉取状态，防止切号/后台改动后展示过期结果。
        requestGuardRef.current.invalidateStatus();
        inFlightSnapshotRef.current = null;
        refreshOnActiveRef.current?.();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [token]);

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
  if (effectiveEnabled) {
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
