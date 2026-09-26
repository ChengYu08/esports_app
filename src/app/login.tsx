import { createAuthSsoAdapter, LoginScreen, useAuthStore } from "@esports/auth";
import { SsoClient } from "@esports/sso-sdk";
import { env } from "@/core/config/env";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { Alert, Platform } from "react-native";

export default function LoginRoute() {
  const setSession = useAuthStore((state) => state.setSession);
  const sso = useMemo(() => env.ssoClientSecret ? new SsoClient({ baseUrl: env.apiBaseUrl, clientAppId: env.ssoClientAppId, clientSecret: env.ssoClientSecret, os: Platform.OS === "ios" ? "iOS" : "Android" }) : null, []);
  const adapter = sso ? createAuthSsoAdapter(sso) : null;
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden />
      <LoginScreen
        onBack={() => router.back()}
        onSkip={() => router.replace("/")}
        onSendCode={adapter?.sendCode}
        onQuickLogin={() => Alert.alert("暂无法一键登录", "当前构建尚未配置运营商原生认证 SDK，请使用验证码登录。")}
        onLogin={async (payload) => {
          if (!adapter) return;
          const token = await adapter.login(payload);
          if (token.access_token) setSession({ accessToken: token.access_token, user: { id: token.id_token ?? payload.phone, phone: payload.phone } });
          router.replace("/");
        }}
      />
    </>
  );
}
