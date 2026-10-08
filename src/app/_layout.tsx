import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
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
import { disconnectRongCloud } from "@/features/message/rongcloud-im";

const fonts = {
  [DOUYIN_SANS]: require("../../assets/fonts/Douyin Sans.otf"),
};

export default function RootLayout() {
  const [loaded, error] = useFonts(fonts);
  const [sessionReady, setSessionReady] = useState(false);
  const [privacyReady, setPrivacyReady] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);

  useEffect(() => {
    let active = true;
    void (async () => {
      const hasPrivacyConsent = await readPrivacyConsent();
      if (active) {
        setPrivacyAccepted(hasPrivacyConsent);
        setPrivacyReady(true);
      }
      if (!hasPrivacyConsent) {
        if (active) setSessionReady(true);
        return;
      }
      const session = await readAuthSession();
      if (!session) {
        if (active) setSessionReady(true);
        return;
      }

      setSession(session);
      try {
        const profile = await clientAuthApi.fetchCurrentUser(session.accessToken);
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

  useEffect(() => () => { void disconnectRongCloud(); }, []);

  if ((!loaded && !error) || !sessionReady || !privacyReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        {privacyAccepted ? (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ animation: "none" }} />
            <Stack.Screen name="account-settings" />
          </Stack>
        ) : (
          <PrivacyConsentGate onAccepted={() => setPrivacyAccepted(true)} />
        )}
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
