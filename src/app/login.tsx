import { createAuthSsoAdapter, LoginScreen, useAuthStore } from "@esports/auth";
import { createNativeQuickLoginProvider, SsoClient } from "@esports/sso-sdk";
import { env } from "@/core/config/env";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { Alert, Platform } from "react-native";

export default function LoginRoute() {
  const params = useLocalSearchParams<{ mode?: string; phone?: string }>();
  const initialMode = params.mode === "password" ? "password" : "sms";
  const initialPhone = typeof params.phone === "string" ? params.phone : "";
  const setSession = useAuthStore((state) => state.setSession);
  const sso = useMemo(() => env.ssoClientSecret ? new SsoClient({
    baseUrl: env.ssoBaseUrl,
    clientAppId: env.ssoClientAppId,
    clientSecret: env.ssoClientSecret,
    os: Platform.OS === "ios" ? "iOS" : "Android",
    sourceType: Platform.OS === "ios" ? "GUHAO_IOS" : "GUHAO_ANDROID",
    onRequestLog: (log) => console.log("[SSO]", JSON.stringify(log)),
  }) : null, []);
  const adapter = sso ? createAuthSsoAdapter(sso) : null;
  const quickLoginProvider = useMemo(() => createNativeQuickLoginProvider(), []);
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden />
      <LoginScreen
        initialMode={initialMode}
        initialPhone={initialPhone}
        onBack={() => router.back()}
        onSkip={() => router.replace("/")}
        onSendCode={async (phone) => {
          if (!adapter) {
            Alert.alert("验证码发送失败", "请先配置 SSO client secret。");
            throw new Error("SSO client secret is not configured");
          }
          try {
            await adapter.sendCode(phone);
          } catch (error) {
            Alert.alert(
              "验证码发送失败",
              error instanceof Error ? error.message : "请稍后重试",
            );
            throw error;
          }
        }}
        onPasswordLogin={async (payload) => {
          if (!adapter) {
            Alert.alert("密码登录失败", "请先配置 SSO client secret。");
            return;
          }
          try {
            const token = await adapter.passwordLogin(payload);
            if (token.access_token) {
              setSession({
                accessToken: token.access_token,
                user: {
                  id: token.id_token ?? payload.username,
                  phone: payload.username,
                },
              });
            }
            router.replace("/");
          } catch (error) {
            Alert.alert(
              "密码登录失败",
              error instanceof Error ? error.message : "请检查手机号和密码",
            );
          }
        }}
        onForgotPassword={(phone) =>
          router.push({ pathname: "/forgot-password", params: { phone } })
        }
        onQuickLogin={async () => {
          if (!adapter) {
            Alert.alert("暂无法一键登录", "请先配置 SSO client secret。");
            return;
          }
          try {
            const token = await adapter.quickLogin(quickLoginProvider);
            if (token.access_token) setSession({ accessToken: token.access_token, user: { id: token.id_token ?? token.phone ?? "unknown", phone: token.phone } });
            router.replace("/");
          } catch (error) {
            Alert.alert("一键登录不可用", error instanceof Error ? error.message : "请使用验证码登录");
          }
        }}
        onLogin={async (payload) => {
          if (!adapter) {
            Alert.alert("登录失败", "请先配置 SSO client secret。");
            return;
          }
          try {
            const token = await adapter.login(payload);
            if (token.access_token) setSession({ accessToken: token.access_token, user: { id: token.id_token ?? payload.phone, phone: payload.phone } });
            router.replace("/");
          } catch (error) {
            Alert.alert(
              "登录失败",
              error instanceof Error ? error.message : "请检查手机号和验证码",
            );
          }
        }}
      />
    </>
  );
}
