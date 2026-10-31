import { env } from "@/core/config/env";
import { createAuthSsoAdapter, ForgotPasswordScreen } from "@esports/auth";
import { SsoClient } from "@esports/sso-sdk";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Platform } from "react-native";
import { showToast } from "@/shared/ui/app-toast";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function ForgotPasswordRoute() {
  const params = useLocalSearchParams<{ phone?: string }>();
  const initialPhone = typeof params.phone === "string" ? params.phone : "";
  const sso = useMemo(
    () =>
      env.ssoClientSecret
        ? new SsoClient({
            baseUrl: env.ssoBaseUrl,
            clientAppId: env.ssoClientAppId,
            clientSecret: env.ssoClientSecret,
            os: Platform.OS === "ios" ? "iOS" : "Android",
            sourceType:
              Platform.OS === "ios" ? "dianjing-ios" : "dianjing-android",
            referer: env.referer,
          })
        : null,
    [],
  );
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
            showToast(`验证码发送失败，${error.message}`);
            throw error;
          }
          try {
            await adapter.sendResetCode(phone);
          } catch (error) {
            showToast(
              `验证码发送失败，${getErrorMessage(error, "发送验证码失败")}`,
            );
            throw error;
          }
        }}
        onSubmit={async (payload) => {
          if (!adapter) {
            const error = new Error("请先配置 SSO client secret。");
            showToast(`密码重置失败，${error.message}`);
            throw error;
          }
          try {
            await adapter.forgetPassword(payload);
            showToast("密码重置成功，请使用新密码登录。");
            router.replace({
              pathname: "/login",
              params: { mode: "password", phone: payload.phone },
            });
          } catch (error) {
            showToast(
              `密码重置失败，${getErrorMessage(error, "密码重置失败")}`,
            );
            throw error;
          }
        }}
      />
    </>
  );
}
