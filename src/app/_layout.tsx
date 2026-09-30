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

const fonts = {
  [DOUYIN_SANS]: require("../../assets/fonts/Douyin Sans.otf"),
};

export default function RootLayout() {
  const [loaded, error] = useFonts(fonts);
  const [sessionReady, setSessionReady] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);

  useEffect(() => {
    let active = true;
    void (async () => {
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

  if ((!loaded && !error) || !sessionReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ animation: "none" }} />
          <Stack.Screen name="account-settings" />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
