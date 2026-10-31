import { useAuthStore } from "@esports/auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { RootSiblingParent } from "react-native-root-siblings";
import { showToast } from "@/shared/ui/app-toast";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { setAuthExpiredHandler } from "@/core/network/api-client";
import { queryClient } from "@/core/query/query-client";
import { toAuthUser } from "@/features/auth/client-auth-flow";
import { clientAuthApi } from "@/features/auth/client-auth.api";
import { useOnboardingStore } from "@/features/auth/onboarding-store";
import {
  clearAuthSession,
  readAuthSession,
  saveAuthSession,
} from "@/features/auth/session-persistence";
import { useNetworkRecovery } from "@/core/query/use-network-recovery";
import {
  messageStore,
  useMessageStore,
} from "@/features/message/message-store";
import { InAppNotificationBanner } from "@/features/message/components/InAppNotificationBanner";
import { RongCommandHost } from "@/features/message/rong-command-dispatch/RongCommandHost";
import { OrderNotifySyncHost } from "@/features/order/order-notify-sync";
import { VoiceRoomMiniPlayer } from "@/features/voice-room/components/VoiceRoomMiniPlayer";
import { VoiceRoomKickListener } from "@/features/voice-room/components/VoiceRoomKickListener";
import { leaveVoiceRtc } from "@/features/voice-room/voice-room-rtc";
import { leaveVoiceChatRoom } from "@/features/voice-room/voice-room-rongcloud";
import { useVoiceRoomSessionStore } from "@/features/voice-room/voice-room-session";
import { VoiceRoomJoinedSyncHost } from "@/features/voice-room/use-sync-joined-voice-room";
import { PushyUpdateHost } from "@/features/ota/PushyUpdateHost";
import { AppUpgradeHost } from "@/features/app-upgrade/AppUpgradeHost";
import { TeenModeGate } from "@/features/mine/components/TeenModeGate";
import { PrivacyConsentGate } from "@/features/privacy/components/PrivacyConsentGate";
import { readPrivacyConsent } from "@/features/privacy/privacy-consent";
import { ActionNoticeHost } from "@/shared/ui/action-notice";
import { AppConfirmHost } from "@/shared/ui/AppConfirmHost";

import { StartupSplash } from "@/shared/ui/StartupSplash";

// Keep the native screen until the full-screen artwork is ready to display.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Android 13+ requires runtime POST_NOTIFICATIONS permission for vendor offline push.
function requestNotificationPermissionIfNeeded() {
  PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(
    () => undefined,
  );
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
  const onboardingHydrated = useOnboardingStore((state) => state.hydrated);
  const shouldShowOnboarding = useOnboardingStore(
    (state) => state.shouldShowProfileOnboarding,
  );
  const onboardingChecked = useRef(false);

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
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        requestNotificationPermissionIfNeeded();
      }
      // 防御：同 token 的 initialize 只触发一次，避免 initialize 内部 set 触发
      // React 重渲染 → effect 依赖浅比较失败 → 重复 initialize 形成抖动循环。
      if (lastInitToken.current === accessToken) return;
      lastInitToken.current = accessToken;
      void initializeMessages(accessToken);
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
    const { activeRoom, joiningRoom, clearActiveRoom } = useVoiceRoomSessionStore.getState();
    clearActiveRoom();
    if (!activeRoom && !joiningRoom) return;
    void leaveVoiceRtc();
    const chatroomIds = new Set([activeRoom?.rongChatroomId, joiningRoom?.rongChatroomId]);
    chatroomIds.forEach((chatroomId) => {
      if (chatroomId) void leaveVoiceChatRoom(chatroomId).catch(() => undefined);
    });
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    void (async () => {
      // 先恢复 onboarding 状态
      await useOnboardingStore.getState().hydrate();

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

  // 已登录用户启动 app 时，检查是否需要显示资料完善页
  useEffect(() => {
    if (
      !onboardingHydrated ||
      !sessionReady ||
      !accessToken ||
      onboardingChecked.current
    ) return;

    const user = useAuthStore.getState().user;
    if (user?.id && shouldShowOnboarding(user.id)) {
      onboardingChecked.current = true;
      router.replace("/onboarding");
    }
  }, [onboardingHydrated, sessionReady, accessToken, shouldShowOnboarding]);

  useEffect(
    () => () => {
      void messageStore.getState().reset();
    },
    [],
  );

  if (!splashReady || !sessionReady || !privacyReady) {
    return <StartupSplash onFinished={finishSplash} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <RootSiblingParent>
            <StatusBar style="dark" />
            {privacyAccepted ? (
              <PushyUpdateHost>
                {/* 网络监控、整包升级检查与热更新均在同意隐私后启动 */}
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
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="onboarding"
                    options={{ headerShown: false, gestureEnabled: false }}
                  />
                  <Stack.Screen
                    name="image-preview"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen name="basic-settings" />
                  <Stack.Screen name="account-settings" />
                  <Stack.Screen name="about" />
                </Stack>
                {/* 青少年模式启动门：enabled 时整屏锁定，未开启按每日规则弹促销窗 */}
                <TeenModeGate />
              </PushyUpdateHost>
            ) : (
              <PrivacyConsentGate onAccepted={() => setPrivacyAccepted(true)} />
            )}
            <InAppNotificationBanner visible={!pathname.startsWith("/voice-room/")} />
            <ActionNoticeHost />
            <VoiceRoomMiniPlayer />
            <VoiceRoomJoinedSyncHost enabled={privacyAccepted} />
            <VoiceRoomKickListener />
            <RongCommandHost />
            <OrderNotifySyncHost />
            <AppConfirmHost />
          </RootSiblingParent>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

function NetworkRecovery() {
  useNetworkRecovery();
  return null;
}
