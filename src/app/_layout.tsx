import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Image } from "expo-image";
import { Stack } from "expo-router";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootSiblingParent } from "react-native-root-siblings";
import { useEffect, useState } from "react";
import { useAuthStore } from "@esports/auth";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import { queryClient } from "@/core/query/query-client";
import { ApiError } from "@/core/network/api-client";
import { clientAuthApi } from "@/features/auth/client-auth.api";
import { toAuthUser } from "@/features/auth/client-auth-flow";
import { clearAuthSession, readAuthSession, saveAuthSession } from "@/features/auth/session-persistence";
import { PrivacyConsentGate } from "@/features/privacy/components/PrivacyConsentGate";
import { readPrivacyConsent } from "@/features/privacy/privacy-consent";
import { messageStore, useMessageStore } from "@/features/message/message-store";

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
  [DOUYIN_SANS]: require("../../assets/fonts/Douyin Sans.otf"),
};
const splashImage = require("../../assets/images/splash-screen.png");

export default function RootLayout() {
  const [loaded, error] = useFonts(fonts);
  const [sessionReady, setSessionReady] = useState(false);
  const [privacyReady, setPrivacyReady] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const accessToken = useAuthStore((state) => state.accessToken);
  const initializeMessages = useMessageStore((state) => state.initialize);
  const resetMessages = useMessageStore((state) => state.reset);

  useEffect(() => {
    if (accessToken && privacyAccepted) void initializeMessages(accessToken);
    else if (privacyReady) void resetMessages();
  }, [accessToken, initializeMessages, privacyAccepted, privacyReady, resetMessages]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const hasPrivacyConsent = await withStartupTimeout(readPrivacyConsent(), false);
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
        const profile = await withStartupTimeout(clientAuthApi.fetchCurrentUser(session.accessToken), null);
        if (!profile) {
          if (active) setSessionReady(true);
          return;
        }
        const refreshedSession = { accessToken: session.accessToken, user: toAuthUser(profile, typeof session.user.phone === "string" ? session.user.phone : undefined) };
        await saveAuthSession(refreshedSession);
        if (active) setSession(refreshedSession);
      } catch (requestError) {
        if (requestError instanceof ApiError && requestError.status === 401) {
          await clearAuthSession();
          if (active) clearSession();
        }
      } finally {
        if (active) setSessionReady(true);
      }
    })();
    return () => { active = false; };
  }, [clearSession, setSession]);

  useEffect(() => () => { void messageStore.getState().reset(); }, []);

  if ((!loaded && !error) || !sessionReady || !privacyReady) {
    return (
      <View style={{ flex: 1, backgroundColor: "#2A1013" }}>
        <Image
          accessibilityIgnoresInvertColors
          contentFit="cover"
          source={splashImage}
          style={{ flex: 1, width: "100%" }}
        />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RootSiblingParent>
          {privacyAccepted ? (
            <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ animation: "none" }} />
              <Stack.Screen
                name="image-preview"
                options={{ animation: "fade", headerShown: false }}
              />
              <Stack.Screen name="basic-settings" />
              <Stack.Screen name="account-settings" />
              <Stack.Screen name="about" />
            </Stack>
          ) : (
            <PrivacyConsentGate onAccepted={() => setPrivacyAccepted(true)} />
          )}
        </RootSiblingParent>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
