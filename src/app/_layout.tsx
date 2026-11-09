import { handlePendingPushClick } from "@/features/message/push-click-handler";
import { showToast } from "@/shared/ui/app-toast";
import { useAuthStore } from "@esports/auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { router, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { RootSiblingParent } from "react-native-root-siblings";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  setAuthExpiredHandler,
  setRealNameRequiredHandler,
} from "@/core/network/api-client";
import { queryClient } from "@/core/query/query-client";
import { useNetworkRecovery } from "@/core/query/use-network-recovery";
import { AppUpgradeHost } from "@/features/app-upgrade/AppUpgradeHost";
import { toAuthUser } from "@/features/auth/client-auth-flow";
import { clientAuthApi } from "@/features/auth/client-auth.api";
import {
  clearAuthSession,
  readAuthSession,
  saveAuthSession,
} from "@/features/auth/session-persistence";
import { InAppNotificationBanner } from "@/features/message/components/InAppNotificationBanner";
import {
  messageStore,
  useMessageStore,
} from "@/features/message/message-store";
import { RongCommandHost } from "@/features/message/rong-command-dispatch/RongCommandHost";
import { TeenModeGate } from "@/features/mine/components/TeenModeGate";
import { OrderNotifySyncHost } from "@/features/order/order-notify-sync";
import { PrivacyConsentGate } from "@/features/privacy/components/PrivacyConsentGate";
import { readPrivacyConsent } from "@/features/privacy/privacy-consent";
import { D_DIN_PRO_FONTS } from "@/shared/theme/typography";
import { VoiceRoomKickListener } from "@/features/voice-room/components/VoiceRoomKickListener";
import { VoiceRoomMiniPlayer } from "@/features/voice-room/components/VoiceRoomMiniPlayer";
import { VoiceRoomJoinedSyncHost } from "@/features/voice-room/use-sync-joined-voice-room";
import { leaveVoiceChatRoom } from "@/features/voice-room/voice-room-rongcloud";
import { leaveVoiceRtc } from "@/features/voice-room/voice-room-rtc";
import { useVoiceRoomSessionStore } from "@/features/voice-room/voice-room-session";
import { ActionNoticeHost } from "@/shared/ui/action-notice";
import { AppConfirmHost } from "@/shared/ui/AppConfirmHost";

import { StartupSplash } from "@/shared/ui/StartupSplash";

// 启动图由 AppTheme 的 windowBackground 全屏承载，无需再钉住/收起系统 splash。

// Android 13+ requires runtime POST_NOTIFICATIONS permission for vendor offline push.
function requestNotificationPermissionIfNeeded() {
  PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  ).catch(() => undefined);
}

const STARTUP_TIMEOUT_MS = 8000;

function withStartupTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), STARTUP_TIMEOUT_MS);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

export default function RootLayout() {
  const pathname = usePathname();
  const [fontsLoaded, fontError] = useFonts(D_DIN_PRO_FONTS);
  const [splashReady, setSplashReady] = useState(false);
  const finishSplash = useCallback(() => setSplashReady(true), []);
  const [sessionReady, setSessionReady] = useState(false);
  const [privacyReady, setPrivacyReady] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const authExpiryTask = useRef<Promise<void> | null>(null);
  const needsLoginRedirect = useRef(false);
  const lastInitToken = useRef<string | null>(null);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const accessToken = useAuthStore((state) => state.accessToken);
  const initializeMessages = useMessageStore((state) => state.initialize);
  const resetMessages = useMessageStore((state) => state.reset);

  useEffect(() => {
    // 全局「未进行实名认证」拦截：接口 info 精确命中时引导跳实名认证页
    return setRealNameRequiredHandler(() => {
      router.push("/real-name-verification");
    });
  }, []);

  useEffect(() => {
    return setAuthExpiredHandler(async (_error, requestToken) => {
      if (useAuthStore.getState().accessToken !== requestToken) return;
      if (authExpiryTask.current) {
        await authExpiryTask.current;
        return;
      }

      needsLoginRedirect.current = true;
      const task = (async () => {
        await clearAuthSession().catch(() => undefined);
        if (useAuthStore.getState().accessToken !== requestToken) {
          needsLoginRedirect.current = false;
          return;
        }
        clearSession();
        queryClient.clear();
      })();
      authExpiryTask.current = task;
      try {
        await task;
      } finally {
        if (authExpiryTask.current === task) authExpiryTask.current = null;
      }
    });
  }, [clearSession]);

  useEffect(() => {
    if (!needsLoginRedirect.current || !sessionReady || accessToken) return;
    needsLoginRedirect.current = false;
    router.replace("/login");
    showToast("登录状态已失效，请重新登录");
  }, [accessToken, sessionReady]);

  useEffect(() => {
    if (accessToken && privacyAccepted) {
      // Android 13+ requires runtime notification permission for vendor offline push.
      if (Platform.OS === "android" && Platform.Version >= 33) {
        requestNotificationPermissionIfNeeded();
      }
      // 防御：同 token 的 initialize 只触发一次，避免 initialize 内部 set 触发
      // React 重渲染 → effect 依赖浅比较失败 → 重复 initialize 形成抖动循环。
      if (lastInitToken.current === accessToken) return;
      lastInitToken.current = accessToken;
      void initializeMessages(accessToken);
      void handlePendingPushClick();
    } else if (privacyReady) {
      lastInitToken.current = null;
      void resetMessages();
    }
  }, [
    accessToken,
    initializeMessages,
    privacyAccepted,
    privacyReady,
    resetMessages,
  ]);

  useEffect(() => {
    if (accessToken) return;
    const { activeRoom, joiningRoom, clearActiveRoom } =
      useVoiceRoomSessionStore.getState();
    clearActiveRoom();
    if (!activeRoom && !joiningRoom) return;
    void leaveVoiceRtc();
    const chatroomIds = new Set([
      activeRoom?.rongChatroomId,
      joiningRoom?.rongChatroomId,
    ]);
    chatroomIds.forEach((chatroomId) => {
      if (chatroomId)
        void leaveVoiceChatRoom(chatroomId).catch(() => undefined);
    });
  }, [accessToken]);

  useEffect(() => {
    // 回前台时确认融云长连接：后台挂起/互踢断开后 SDK 未必自动恢复，
    // 以登录态为前提触发一次幂等重连（实际已连接时 initialize 会直接跳过）
    const subscription = AppState.addEventListener("change", (appState) => {
      if (appState !== "active") return;
      const token = useAuthStore.getState().accessToken;
      if (!token) return;
      void messageStore.getState().initialize(token);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const hasPrivacyConsent = await withStartupTimeout(
        readPrivacyConsent(),
        false,
      );
      if (active) {
        setPrivacyAccepted(hasPrivacyConsent);
        setPrivacyReady(true);
      }
      if (!hasPrivacyConsent) {
        if (active) setSessionReady(true);
        return;
      }
      const session = await withStartupTimeout(readAuthSession(), null);
      if (!session) {
        if (active) setSessionReady(true);
        return;
      }

      setSession(session);
      try {
        const profile = await withStartupTimeout(
          clientAuthApi.fetchCurrentUser(session.accessToken),
          null,
        );
        if (!profile) {
          if (active) setSessionReady(true);
          return;
        }
        const refreshedSession = {
          accessToken: session.accessToken,
          user: toAuthUser(
            profile,
            typeof session.user.phone === "string"
              ? session.user.phone
              : undefined,
          ),
        };
        await saveAuthSession(refreshedSession);
        if (active) setSession(refreshedSession);
      } catch {
        // Profile refresh is best-effort at startup; auth expiry is handled centrally by apiClient.
      } finally {
        if (active) setSessionReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [clearSession, setSession]);

  useEffect(
    () => () => {
      void messageStore.getState().reset();
    },
    [],
  );

  if ((!fontsLoaded && !fontError) || !splashReady || !sessionReady || !privacyReady) {
    return <StartupSplash onFinished={finishSplash} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <RootSiblingParent>
              <StatusBar style="dark" />
              {privacyAccepted ? (
                <>
                  {/* 网络监控与整包升级检查在同意隐私后启动 */}
                  <NetworkRecovery />
                  <AppUpgradeHost />
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      gestureEnabled: true,
                      animation: "fade",
                      animationMatchesGesture: false,
                      fullScreenGestureEnabled: false,
                    }}
                  >
                    <Stack.Screen
                      name="(tabs)"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="image-preview"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen name="basic-settings" />
                    <Stack.Screen name="account-settings" />
                    <Stack.Screen name="about" />
                  </Stack>
                  {/* 青少年模式启动门：开启且在服务端配置的锁定时段内整屏锁定，未开启按每日规则弹促销窗 */}
                  <TeenModeGate />
                </>
              ) : (
                <PrivacyConsentGate
                  onAccepted={() => setPrivacyAccepted(true)}
                />
              )}
              <InAppNotificationBanner
                visible={!pathname.startsWith("/voice-room/")}
              />
              <ActionNoticeHost />
              <VoiceRoomMiniPlayer />
              <VoiceRoomJoinedSyncHost enabled={privacyAccepted} />
              <VoiceRoomKickListener />
              <RongCommandHost />
              <OrderNotifySyncHost />
              <AppConfirmHost />
            </RootSiblingParent>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

function NetworkRecovery() {
  useNetworkRecovery();
  return null;
}
