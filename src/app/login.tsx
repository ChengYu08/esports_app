import { env } from "@/core/config/env";
import { APP_LINKS } from "@/core/config/links";
import {
  CancellationCoolingDialog,
} from "@/features/auth/CancellationCoolingDialog";
import { completeClientLogin } from "@/features/auth/client-auth-flow";
import {
  clearCoolingRecord,
  readCoolingRecord,
} from "@/features/auth/cancellation-cooling-store";
import {
  isCoolingActive,
  type CoolingRecord,
} from "@/features/auth/cancellation-cooling";
import { useOnboardingStore } from "@/features/auth/onboarding-store";
import { getPasswordLoginErrorMessage } from "@/features/auth/password-login-error";
import { openExternalLink } from "@/shared/navigation/open-external-link";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { createAuthSsoAdapter, LoginScreen, useAuthStore } from "@esports/auth";
import { createNativeQuickLoginProvider, SsoClient } from "@esports/sso-sdk";
import {
  router,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { BackHandler, Platform } from "react-native";
import { showToast } from "@/shared/ui/app-toast";

export default function LoginRoute() {
  const params = useLocalSearchParams<{ mode?: string; phone?: string }>();
  const initialMode = params.mode === "password" ? "password" : "sms";
  const initialPhone = typeof params.phone === "string" ? params.phone : "";
  const setSession = useAuthStore((state) => state.setSession);
  const setCompanionStatus = useAuthStore((state) => state.setCompanionStatus);
  const shouldShowOnboarding = useOnboardingStore(
    (state) => state.shouldShowProfileOnboarding,
  );
  const [passwordLoginError, setPasswordLoginError] = useState<string | null>(
    null,
  );
  const [coolingRecord, setCoolingRecord] = useState<CoolingRecord | null>(
    null,
  );
  const [coolingDialogVisible, setCoolingDialogVisible] = useState(false);
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
            onRequestLog: (log) => console.log("[SSO]", JSON.stringify(log)),
          })
        : null,
    [],
  );
  const adapter = sso ? createAuthSsoAdapter(sso) : null;
  const quickLoginProvider = useMemo(
    () =>
      createNativeQuickLoginProvider(
        Platform.OS === "ios" ? env.aliyunIosAuthKey : env.aliyunAndroidAuthKey,
      ),
    [],
  );
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      // Tabs replace themselves with login, so the system back action needs a home fallback.
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          router.replace("/");
          return true;
        },
      );
      return () => subscription.remove();
    }, []),
  );
  useFocusEffect(
    useCallback(() => {
      let active = true;
      readCoolingRecord().then((record) => {
        if (!active) return;
        if (isCoolingActive(record)) {
          setCoolingRecord(record);
          setCoolingDialogVisible(true);
        } else {
          setCoolingRecord(null);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const ensureNotCooling = () => {
    if (coolingRecord) {
      setCoolingDialogVisible(true);
      return false;
    }
    return true;
  };

  // 新登录用户（register=true）或需要完善资料的老用户，跳转到资料完善页
  const resolvePostLoginRoute = (userId: string, isNewUser: boolean) => {
    if (isNewUser || shouldShowOnboarding(userId)) return "/onboarding";
    return "/";
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LoginScreen
        initialMode={initialMode}
        initialPhone={initialPhone}
        onBack={() => router.replace("/")}
        onSkip={() => router.replace("/")}
        onSendCode={async (phone) => {
          if (!ensureNotCooling()) return;
          if (!adapter) {
            showToast("验证码发送失败，请先配置 SSO client secret。");
            throw new Error("SSO client secret is not configured");
          }
          try {
            await adapter.sendCode(phone);
          } catch (error) {
            showToast(
              `验证码发送失败，${error instanceof Error ? error.message : "请稍后重试"}`,
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
            const { login, profile } = await completeClientLogin(
              token,
              "PASSWORD",
              setSession,
              setCompanionStatus,
              payload.username,
            );
            router.replace(resolvePostLoginRoute(String(profile.id), login.register));
          } catch (error) {
            setPasswordLoginError(getPasswordLoginErrorMessage(error));
          }
        }}
        onForgotPassword={(phone) =>
          router.push({ pathname: "/forgot-password", params: { phone } })
        }
        onUserAgreementPress={() =>
          void openExternalLink(APP_LINKS.userAgreement)
        }
        onPrivacyPolicyPress={() =>
          void openExternalLink(APP_LINKS.privacyPolicy)
        }
        onQuickLogin={async () => {
          if (!ensureNotCooling()) return;
          console.info("[DEBUG-QUICK-LOGIN] button pressed", {
            platform: Platform.OS,
            ssoConfigured: Boolean(env.ssoClientSecret),
          });
          if (!adapter) {
            console.warn(
              "[DEBUG-QUICK-LOGIN] stopped: SSO client secret is not configured",
            );
            showToast("暂无法一键登录，请先配置 SSO client secret。");
            return;
          }
          try {
            const token = await adapter.quickLogin(quickLoginProvider);
            const { login, profile } = await completeClientLogin(
              token,
              "ONE_CLICK_LOGIN",
              setSession,
              setCompanionStatus,
              token.phone,
            );
            router.replace(resolvePostLoginRoute(String(profile.id), login.register));
          } catch (error) {
            // 用户在一键登录授权页主动返回：原生侧用 USER_CANCELLED 标记，静默即可
            if (
              error &&
              typeof error === "object" &&
              "code" in error &&
              (error as { code?: unknown }).code === "USER_CANCELLED"
            ) {
              return;
            }
            console.error("[DEBUG-QUICK-LOGIN] failed", {
              name: error instanceof Error ? error.name : "UnknownError",
              message: error instanceof Error ? error.message : String(error),
            });
            showToast(
              `一键登录不可用，${error instanceof Error ? error.message : "请使用验证码登录"}`,
            );
          }
        }}
        onLogin={async (payload) => {
          if (!ensureNotCooling()) return;
          if (!adapter) {
            showToast("登录失败，请先配置 SSO client secret。");
            return;
          }
          try {
            const token = await adapter.login(payload);
            const { login, profile } = await completeClientLogin(
              token,
              "SMS_CODE",
              setSession,
              setCompanionStatus,
              payload.phone,
            );
            router.replace(resolvePostLoginRoute(String(profile.id), login.register));
          } catch (error) {
            showToast(
              `登录失败，${error instanceof Error ? error.message : "请检查手机号和验证码"}`,
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
      {coolingRecord ? (
        <CancellationCoolingDialog
          record={coolingRecord}
          visible={coolingDialogVisible}
          onCancel={() => setCoolingDialogVisible(false)}
          onAbandon={() => {
            void clearCoolingRecord();
            setCoolingRecord(null);
            setCoolingDialogVisible(false);
          }}
        />
      ) : null}
    </>
  );
}
