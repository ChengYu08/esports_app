import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "@esports/auth";

import { didLoginThisLaunch } from "@/features/auth/client-auth-flow";
import TeenModeScreen from "@/features/mine/screens/TeenModeScreen";
import { TeenModePromoDialog } from "@/features/mine/components/TeenModePromoDialog";
import { teenModeApi } from "@/features/mine/api/teen-mode.api";
import type { TeenModeStatus } from "@/features/mine/api/teen-mode.contract";
import {
  readLastTeenEnabled,
  readTeenClockOffset,
  saveLastTeenEnabled,
  saveTeenClockOffset,
  readTeenPopupCache,
  saveTeenPopupCache,
} from "@/features/mine/teen-mode-store";
import {
  shouldShowTeenPopup,
  todayString,
} from "@/features/mine/utils/teen-popup";
import {
  isTeenLockWindow,
  msUntilTeenLockBoundary,
} from "@/features/mine/utils/teen-lock-window";

/**
 * 青少年模式启动门（仅登录后挂载）：
 * - 启动时拉取 /youth/status（每次启动一次），用响应里的 serverTime 校准本地时钟偏移；
 * - enabled=true 且北京时间 17:00-次日 06:00（服务端时间口径）：整屏渲染锁定页，关闭后门禁解除；
 * - enabled=true 但不处于生效时间窗：不阻断，正常使用 App；
 * - enabled=false：按每日首启规则弹"去开启/我知道了"促销弹窗（仅启动拉取时评估，回前台刷新不重弹）；
 * - 状态拉取失败且本地镜像为已开启：沿用上次的开启状态与偏移量继续判定（fail-closed，
 *   防已开启用户断网绕过）；从未拉取过则不阻断（fail-open），下次启动重试；
 * - 回到前台会重拉状态重校准时钟（防会话中途改设备时间绕过），结果只更新锁定判定。
 *
 * 时间防绕过：所有时段判定用 Date.now() + 服务端校准偏移，且固定按北京时间（UTC+8）
 * 换算，改设备时间/时区无效；服务端另有 YouthModeLockInterceptor 兜底拦截业务接口。
 * 镜像与偏移缓存均按账号维度存储，多账号同设备互不串扰。
 */
export function TeenModeGate() {
  const token = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [status, setStatus] = useState<TeenModeStatus | null>(null);
  const [cachedEnabled, setCachedEnabled] = useState(false);
  const [promoVisible, setPromoVisible] = useState(false);
  const [inLockWindow, setInLockWindow] = useState(() =>
    isTeenLockWindow(Date.now()),
  );
  // 本地时钟相对服务端的偏移（serverTime - Date.now()），启动时从缓存恢复
  const clockOffsetRef = useRef(0);
  const fetchedForTokenRef = useRef<string | null>(null);
  // 本轮登录是否已拿到服务端实时状态：为真后缓存恢复不再覆盖（防「网络先回、存储后回」竞态）
  const statusSyncedRef = useRef(false);
  // 回前台重拉状态的回调（由拉取 effect 注入，避免依赖变化重建定时器链）
  const refreshOnActiveRef = useRef<(() => void) | null>(null);
  // 同一 token 的在途请求去重（换号不阻塞）
  const inFlightTokenRef = useRef<string | null>(null);

  const calibratedNow = () => Date.now() + clockOffsetRef.current;

  const applyServerTime = (serverTime?: number) => {
    if (typeof serverTime !== "number" || !Number.isFinite(serverTime)) {
      return;
    }
    clockOffsetRef.current = serverTime - Date.now();
    void saveTeenClockOffset(clockOffsetRef.current, userId);
    setInLockWindow(isTeenLockWindow(calibratedNow()));
  };

  const applyStatus = useCallback(
    (next: TeenModeStatus) => {
      statusSyncedRef.current = true;
      setStatus(next);
      setCachedEnabled(next.enabled);
      applyServerTime(next.serverTime);
      void saveLastTeenEnabled(next.enabled, userId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId],
  );

  // 启动/换号即恢复该账号缓存：时钟偏移 + 最近已知开启状态（状态拉取失败时的 fail-closed 依据）
  useEffect(() => {
    if (!token) {
      return;
    }
    void (async () => {
      const [enabled, offset] = await Promise.all([
        readLastTeenEnabled(userId),
        readTeenClockOffset(userId),
      ]);
      // 竞态兜底：期间网络状态已回填则放弃陈旧缓存
      if (statusSyncedRef.current) {
        return;
      }
      if (offset !== null) {
        clockOffsetRef.current = offset;
      }
      setCachedEnabled(enabled === true);
      setInLockWindow(isTeenLockWindow(calibratedNow()));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId]);

  // 跨过 17:00 / 06:00 边界重新判定锁定状态：
  // - 自续订定时器（与状态是否变化无关），避免系统延迟触发后判定结果不变导致定时器链断掉；
  // - 回到前台立即重判 + 重拉状态（覆盖后台挂起跨边界、超时定时器迟到、会话中途改设备时间）。
  useEffect(() => {
    if (!token) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const evaluate = () => {
      const now = calibratedNow();
      setInLockWindow(isTeenLockWindow(now));
      timer = setTimeout(evaluate, msUntilTeenLockBoundary(now));
    };
    evaluate();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        // 先清旧定时器再重判，避免多次前后台切换累积孤儿定时器链
        if (timer) {
          clearTimeout(timer);
        }
        evaluate();
        refreshOnActiveRef.current?.();
      }
    });
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // 登出：清掉上一账号的内存状态（状态/镜像/促销弹窗/同步标记），缓存镜像按账号存、无需清
    if (!token) {
      fetchedForTokenRef.current = null;
      statusSyncedRef.current = false;
      setStatus(null);
      setCachedEnabled(false);
      setPromoVisible(false);
      return;
    }

    // 拉取状态；allowPromo 时附带评估促销弹窗（回前台刷新不重弹已关掉的弹窗）
    const runFetch = async (targetToken: string, allowPromo: boolean) => {
      if (inFlightTokenRef.current === targetToken) {
        return;
      }
      inFlightTokenRef.current = targetToken;
      try {
        const next = await teenModeApi.status(targetToken);
        // 过期响应（登出/换号后迟到）丢弃
        if (fetchedForTokenRef.current !== targetToken) {
          return;
        }
        applyStatus(next);
        if (allowPromo && !next.enabled && !didLoginThisLaunch()) {
          const cache = await readTeenPopupCache();
          // 期间可能已换号，二次校验后再展示
          if (fetchedForTokenRef.current === targetToken) {
            setPromoVisible(shouldShowTeenPopup(cache, todayString()));
          }
        }
      } catch {
        // fail-closed 交由缓存镜像（cachedEnabled）兜底；从未拉取过则 fail-open 不锁定
      } finally {
        if (inFlightTokenRef.current === targetToken) {
          inFlightTokenRef.current = null;
        }
      }
    };

    // 回前台：重拉状态重校准时钟（仅刷新锁定判定，不重评促销弹窗）
    refreshOnActiveRef.current = () => {
      void runFetch(token, false);
    };

    // 同一 token 的 effect 重跑（含 userId 变化触发）不重复拉取；换号则重置状态后重拉
    if (fetchedForTokenRef.current === token) {
      return;
    }
    fetchedForTokenRef.current = token;
    statusSyncedRef.current = false;
    setStatus(null);
    setCachedEnabled(false);
    setPromoVisible(false);
    void runFetch(token, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId]);

  const handleStatusChanged = (next: TeenModeStatus) => {
    applyStatus(next);
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

  // 服务端状态优先；拉取失败时退回本地镜像（fail-closed）
  const effectiveEnabled = status?.enabled ?? cachedEnabled;
  if (effectiveEnabled && inLockWindow) {
    // 锁定页：覆盖全部功能，输密码关闭后经 onStatusChanged 解除
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
