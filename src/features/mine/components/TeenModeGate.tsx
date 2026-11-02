import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "@esports/auth";

import { didLoginThisLaunch } from "@/features/auth/client-auth-flow";
import TeenModeScreen from "@/features/mine/screens/TeenModeScreen";
import { TeenModePromoDialog } from "@/features/mine/components/TeenModePromoDialog";
import { teenModeApi } from "@/features/mine/api/teen-mode.api";
import type { TeenModeStatus } from "@/features/mine/api/teen-mode.contract";
import {
  readTeenPopupCache,
  saveLastTeenEnabled,
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
 * - 启动时拉取 /youth/status（每次启动一次）；
 * - enabled=true 且处于 22:00-次日 06:00（手机本地时间）：整屏渲染锁定页，关闭后门禁解除；
 * - enabled=true 但不处于生效时间窗：不阻断，正常使用 App；
 * - enabled=false：按每日首启规则弹"去开启/我知道了"促销弹窗；
 * - 状态获取失败不阻断 App（fail-open），下次启动重试。
 */
export function TeenModeGate() {
  const token = useAuthStore((state) => state.accessToken);
  const [status, setStatus] = useState<TeenModeStatus | null>(null);
  const [promoVisible, setPromoVisible] = useState(false);
  const [inLockWindow, setInLockWindow] = useState(() => isTeenLockWindow());
  const fetchedForTokenRef = useRef<string | null>(null);

  // 跨过 22:00 / 06:00 边界重新判定锁定状态：
  // - 自续订定时器（与状态是否变化无关），避免系统延迟触发后判定结果不变导致定时器链断掉；
  // - 回到前台立即重判，覆盖后台挂起跨边界、超时定时器迟到、手动改时间等场景。
  useEffect(() => {
    if (!token) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const evaluate = () => {
      setInLockWindow(isTeenLockWindow());
      timer = setTimeout(evaluate, msUntilTeenLockBoundary());
    };
    evaluate();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        evaluate();
      }
    });
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      subscription.remove();
    };
  }, [token]);

  useEffect(() => {
    // 登出：仅重置拉取标记（引用写入），状态在下一次登录拉取时自然覆盖
    if (!token) {
      fetchedForTokenRef.current = null;
      return;
    }
    if (fetchedForTokenRef.current === token) {
      return;
    }
    fetchedForTokenRef.current = token;
    void (async () => {
      try {
        const next = await teenModeApi.status(token);
        // 过期响应（登出/换号后迟到）丢弃
        if (fetchedForTokenRef.current !== token) {
          return;
        }
        setStatus(next);
        void saveLastTeenEnabled(next.enabled);
        // 完成登录后的下次启动才弹促销弹窗（本次启动发生登录则不弹）
        let showPromo = false;
        if (!next.enabled && !didLoginThisLaunch()) {
          const cache = await readTeenPopupCache();
          showPromo = shouldShowTeenPopup(cache, todayString());
        }
        setPromoVisible(showPromo);
      } catch {
        // fail-open：状态获取失败不锁定、不弹窗
      }
    })();
  }, [token]);

  const handleStatusChanged = (next: TeenModeStatus) => {
    setStatus(next);
    void saveLastTeenEnabled(next.enabled);
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

  if (status?.enabled && inLockWindow) {
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

