import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
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

/**
 * 青少年模式启动门（仅登录后挂载）：
 * - 启动时拉取 /youth/status（每次启动一次）；
 * - enabled=true：整屏渲染青少年模式锁定页，关闭后门禁解除；
 * - enabled=false：按每日首启规则弹"去开启/我知道了"促销弹窗；
 * - 状态获取失败不阻断 App（fail-open），下次启动重试。
 */
export function TeenModeGate() {
  const token = useAuthStore((state) => state.accessToken);
  const [status, setStatus] = useState<TeenModeStatus | null>(null);
  const [promoVisible, setPromoVisible] = useState(false);
  const fetchedForTokenRef = useRef<string | null>(null);

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

  if (status?.enabled) {
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

