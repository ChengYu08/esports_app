import { createAuthSsoAdapter, LoginScreen, useAuthStore } from "@esports/auth";
import { createNativeQuickLoginProvider, SsoClient } from "@esports/sso-sdk";
import { env } from "@/core/config/env";
import { APP_LINKS } from "@/core/config/links";
import { completeClientLogin } from "@/features/auth/client-auth-flow";
import { getPasswordLoginErrorMessage } from "@/features/auth/password-login-error";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { openExternalLink } from "@/shared/navigation/open-external-link";
import { Stack, router, useLocalSearchParams } from "expo-router";
import Toast from "react-native-root-toast";
import { useMemo, useState } from "react";
import { Platform } from "react-native";

export default function LoginRoute() {
  const params = useLocalSearchParams<{ mode?: string; phone?: string }>();
  const initialMode = params.mode === "password" ? "password" : "sms";
  const initialPhone = typeof params.phone === "string" ? params.phone : "";
  const setSession = useAuthStore((state) => state.setSession);
  const setCompanionStatus = useAuthStore((state) => state.setCompanionStatus);
  const [passwordLoginError, setPasswordLoginError] = useState<string | null>(null);
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
      <LoginScreen
        initialMode={initialMode}
        initialPhone={initialPhone}
        onBack={() => router.replace("/")}
        onSkip={() => router.replace("/")}
        onSendCode={async (phone) => {
          if (!adapter) {
            Toast.show("验证码发送失败，请先配置 SSO client secret。", { duration: Toast.durations.SHORT });
            throw new Error("SSO client secret is not configured");
          }
          try {
            await adapter.sendCode(phone);
          } catch (error) {
            Toast.show(
              `验证码发送失败，${error instanceof Error ? error.message : "请稍后重试"}`,
              { duration: Toast.durations.SHORT },
            );
            throw error;
          }
        }}
        onPasswordLogin={async (payload) => {
          if (!adapter) {
            setPasswordLoginError("请先配置 SSO client secret。");
            return;
          }
          try {
            const token = await adapter.passwordLogin(payload);
            await completeClientLogin(token, "PASSWORD", setSession, setCompanionStatus, payload.username);
            router.replace("/");
          } catch (error) {
            setPasswordLoginError(getPasswordLoginErrorMessage(error));
          }
        }}
        onForgotPassword={(phone) =>
          router.push({ pathname: "/forgot-password", params: { phone } })
        }
        onUserAgreementPress={() => void openExternalLink(APP_LINKS.userAgreement)}
        onPrivacyPolicyPress={() => void openExternalLink(APP_LINKS.privacyPolicy)}
        onQuickLogin={async () => {
          if (!adapter) {
            Toast.show("暂无法一键登录，请先配置 SSO client secret。", { duration: Toast.durations.SHORT });
            return;
          }
          try {
            const token = await adapter.quickLogin(quickLoginProvider);
            await completeClientLogin(token, "ONE_CLICK_LOGIN", setSession, setCompanionStatus, token.phone);
            router.replace("/");
          } catch (error) {
            Toast.show(
              `一键登录不可用，${error instanceof Error ? error.message : "请使用验证码登录"}`,
              { duration: Toast.durations.SHORT },
            );
          }
        }}
        onLogin={async (payload) => {
          if (!adapter) {
            Toast.show("登录失败，请先配置 SSO client secret。", { duration: Toast.durations.SHORT });
            return;
          }
          try {
            const token = await adapter.login(payload);
            await completeClientLogin(token, "SMS_CODE", setSession, setCompanionStatus, payload.phone);
            router.replace("/");
          } catch (error) {
            Toast.show(
              `登录失败，${error instanceof Error ? error.message : "请检查手机号和验证码"}`,
              { duration: Toast.durations.SHORT },
            );
          }
        }}
      />
      <AppPrompt
        visible={passwordLoginError !== null}
        title="密码登录失败"
        message={passwordLoginError ?? ""}
        onConfirm={() => setPasswordLoginError(null)}
      />
    </>
  );
}
