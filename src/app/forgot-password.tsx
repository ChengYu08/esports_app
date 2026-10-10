import { createAuthSsoAdapter, ForgotPasswordScreen } from "@esports/auth";
import { SsoClient } from "@esports/sso-sdk";
import { env } from "@/core/config/env";
import { Stack, router, useLocalSearchParams } from "expo-router";
import Toast from "react-native-root-toast";
import { useMemo } from "react";
import { Platform } from "react-native";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function ForgotPasswordRoute() {
  const params = useLocalSearchParams<{ phone?: string }>();
  const initialPhone = typeof params.phone === "string" ? params.phone : "";
  const sso = useMemo(() => env.ssoClientSecret ? new SsoClient({
    baseUrl: env.ssoBaseUrl,
    clientAppId: env.ssoClientAppId,
    clientSecret: env.ssoClientSecret,
    os: Platform.OS === "ios" ? "iOS" : "Android",
    sourceType: Platform.OS === "ios" ? "GUHAO_IOS" : "GUHAO_ANDROID",
  }) : null, []);
  const adapter = sso ? createAuthSsoAdapter(sso) : null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ForgotPasswordScreen
        initialPhone={initialPhone}
        onBack={() => router.back()}
        onSendCode={async (phone) => {
          if (!adapter) {
            const error = new Error("请先配置 SSO client secret。");
            Toast.show(`验证码发送失败，${error.message}`, { duration: Toast.durations.SHORT });
            throw error;
          }
          try {
            await adapter.sendResetCode(phone);
          } catch (error) {
            Toast.show(
              `验证码发送失败，${getErrorMessage(error, "发送验证码失败")}`,
              { duration: Toast.durations.SHORT },
            );
            throw error;
          }
        }}
        onSubmit={async (payload) => {
          if (!adapter) {
            const error = new Error("请先配置 SSO client secret。");
            Toast.show(`密码重置失败，${error.message}`, { duration: Toast.durations.SHORT });
            throw error;
          }
          try {
            await adapter.forgetPassword(payload);
            Toast.show("密码重置成功，请使用新密码登录。", { duration: Toast.durations.SHORT });
            router.replace({
              pathname: "/login",
              params: { mode: "password", phone: payload.phone },
            });
          } catch (error) {
            Toast.show(
              `密码重置失败，${getErrorMessage(error, "密码重置失败")}`,
              { duration: Toast.durations.SHORT },
            );
            throw error;
          }
        }}
      />
    </>
  );
}
