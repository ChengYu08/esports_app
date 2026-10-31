import { env } from "@/core/config/env";
import { createAuthSsoAdapter, ForgotPasswordScreen, useAuthStore } from "@esports/auth";
import { SsoClient } from "@esports/sso-sdk";
import { router, Stack } from "expo-router";
import { useMemo } from "react";
import { Platform } from "react-native";
import { showToast } from "@/shared/ui/app-toast";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function ChangePasswordRoute() {
  const phone = useAuthStore((state) => state.user?.phone);
  // 后端返回的手机号是脱敏串（如 139****0001），脱敏时留空由用户自行输入
  const initialPhone = typeof phone === "string" ? phone : "";
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
        title="修改密码"
        onBack={() => router.back()}
        onSendCode={async (targetPhone) => {
          if (!adapter) {
            const error = new Error("请先配置 SSO client secret。");
            showToast(`验证码发送失败，${error.message}`);
            throw error;
          }
          try {
            await adapter.sendResetCode(targetPhone);
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
            showToast(`密码修改失败，${error.message}`);
            throw error;
          }
          try {
            await adapter.forgetPassword(payload);
            showToast("密码修改成功，请使用新密码登录");
            router.back();
          } catch (error) {
            showToast(
              `密码修改失败，${getErrorMessage(error, "密码修改失败")}`,
            );
            throw error;
          }
        }}
      />
    </>
  );
}
