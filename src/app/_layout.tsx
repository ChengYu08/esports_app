import { useAuthStore } from "@esports/auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { router, Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { RootSiblingParent } from "react-native-root-siblings";
import Toast from "react-native-root-toast";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { setAuthExpiredHandler } from "@/core/network/api-client";
import { queryClient } from "@/core/query/query-client";
import { toAuthUser } from "@/features/auth/client-auth-flow";
import { clientAuthApi } from "@/features/auth/client-auth.api";
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
import { ActionCommandDialog } from "@/features/message/action-command/ActionCommandDialog";
import { RongCommandHost } from "@/features/message/rong-command-dispatch/RongCommandHost";
import { VoiceRoomMiniPlayer } from "@/features/voice-room/components/VoiceRoomMiniPlayer";
import { VoiceRoomKickListener } from "@/features/voice-room/components/VoiceRoomKickListener";
import { leaveVoiceRtc } from "@/features/voice-room/voice-room-rtc";
import { leaveVoiceChatRoom } from "@/features/voice-room/voice-room-rongcloud";
import { useVoiceRoomSessionStore } from "@/features/voice-room/voice-room-session";
import { PrivacyConsentGate } from "@/features/privacy/components/PrivacyConsentGate";
import { readPrivacyConsent } from "@/features/privacy/privacy-consent";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { ActionNoticeHost } from "@/shared/ui/action-notice";
import { AppConfirmHost } from "@/shared/ui/AppConfirmHost";
import { StartupSplash } from "@/shared/ui/StartupSplash";

// Keep the native screen until the full-screen artwork is ready to display.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

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

const fonts = {
  [DOUYIN_SANS]: require("../../assets/fonts/DouyinSans.ttf"),
};

export default function RootLayout() {
  const pathname = usePathname();
  const [loaded, error] = useFonts(fonts);
  const [splashReady, setSplashReady] = useState(false);
  const finishSplash = useCallback(() => setSplashReady(true), []);
  const [sessionReady, setSessionReady] = useState(false);
  const [privacyReady, setPrivacyReady] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const authExpiryTask = useRef<Promise<void> | null>(null);
  const needsLoginRedirect = useRef(false);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const accessToken = useAuthStore((state) => state.accessToken);
  const initializeMessages = useMessageStore((state) => state.initialize);
  const resetMessages = useMessageStore((state) => state.reset);

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
    Toast.show("登录状态已失效，请重新登录", {
      duration: Toast.durations.SHORT,
    });
  }, [accessToken, sessionReady]);

  useEffect(() => {
    if (accessToken && privacyAccepted) void initializeMessages(accessToken);
    else if (privacyReady) void resetMessages();
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

  if (!splashReady || (!loaded && !error) || !sessionReady || !privacyReady) {
    return <StartupSplash onFinished={finishSplash} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <RootSiblingParent>
            <StatusBar style="dark" />
            <NetworkRecovery />
            {privacyAccepted ? (
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
                  name="image-preview"
                  options={{ headerShown: false }}
                />
                <Stack.Screen name="basic-settings" />
                <Stack.Screen name="account-settings" />
                <Stack.Screen name="about" />
              </Stack>
            ) : (
              <PrivacyConsentGate onAccepted={() => setPrivacyAccepted(true)} />
            )}
            <InAppNotificationBanner visible={!pathname.startsWith("/voice-room/")} />
            <ActionNoticeHost />
            <VoiceRoomMiniPlayer />
            <VoiceRoomKickListener />
            <RongCommandHost />
            <ActionCommandDialog />
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
