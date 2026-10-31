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
import {
  createNativeQuickLoginProvider,
  QuickLoginCancelledError,
  SsoClient,
} from "@esports/sso-sdk";
import {
  router,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { showToast } from "@/shared/ui/app-toast";

// 新登录用户（register=true）或需要完善资料的老用户，跳转到资料完善页
const resolvePostLoginRoute = (
  userId: string,
  isNewUser: boolean,
  shouldShowOnboarding: (userId: string) => boolean,
) => {
  if (isNewUser || shouldShowOnboarding(userId)) return "/onboarding";
  return "/";
};

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
  const [quickLoginLoading, setQuickLoginLoading] = useState(false);
  // 一键登录优先：进入登录页先探测运营商一键登录可用性
  // checking：探测中，盖全屏加载；ready：可一键登录，已自动拉起授权页；fallback：不可用，直接显示密码/验证码界面
  const [quickLoginPhase, setQuickLoginPhase] = useState<
    "checking" | "ready" | "fallback"
  >(() => (env.ssoClientSecret ? "checking" : "fallback"));
  const quickLoginStartedRef = useRef(false);
  const quickLoginInFlightRef = useRef(false);
  const quickLoginProbedRef = useRef(false);
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
        {
          // 「验证码或密码登录」/返回键：原生关授权页的瞬间就把 RN 遮罩撤掉，
          // 露出下面的密码/验证码表单。等 promise 链路的 finally 再关会晚几百毫秒，
          // 用户会先看到"正在登录…"遮罩，像跳错了页面。
          onAuthPageClosed: () => setQuickLoginLoading(false),
        },
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

  // 拉起运营商授权页并完成一键登录。原生授权页拿到 token 就会关闭，
  // 但 token 换登录态还要几秒网络请求，这期间盖住下面的登录页，
  // 否则用户会看到验证码/密码界面闪一下。
  const runQuickLogin = useCallback(async () => {
    if (!adapter) return;
    // 探测 effect 和手动点击可能并发触发，原生侧同时只承载一个授权页，
    // 重复进入会让取消只关闭其中一个请求，剩下的还在飞，遮罩就一直关不掉。
    if (quickLoginInFlightRef.current) return;
    quickLoginInFlightRef.current = true;
    setQuickLoginLoading(true);
    try {
      const token = await adapter.authorizeQuickLogin(quickLoginProvider);
      const { login, profile } = await completeClientLogin(
        token,
        "ONE_CLICK_LOGIN",
        setSession,
        setCompanionStatus,
        token.phone,
      );
      router.replace(
        resolvePostLoginRoute(
          String(profile.id),
          login.register,
          shouldShowOnboarding,
        ),
      );
    } catch (error) {
      // 用户在授权页主动退出，授权页盖在登录页之上，关掉后自然露出下面的界面。
      // switch：点了「验证码或密码登录」，露出下面的密码/验证码表单，静默即可；
      // exit：点了返回按钮/返回键，退出登录页回首页。
      if (error instanceof QuickLoginCancelledError) {
        console.warn("[DEBUG-QUICK-LOGIN] cancelled", { reason: error.reason });
        // 取消后落到表单态：phase 不再是 ready，回到登录页不会又自动拉起授权页
        setQuickLoginPhase("fallback");
        if (error.reason === "exit") {
          router.replace("/");
        }
        return;
      }
      // 拉起/换 token 阶段失败：授权页已关闭（或根本没拉起），降级到密码/验证码表单。
      setQuickLoginPhase("fallback");
      console.error("[DEBUG-QUICK-LOGIN] failed", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      });
      showToast(
        `一键登录失败，${error instanceof Error ? error.message : "请使用验证码登录"}`,
      );
    } finally {
      quickLoginInFlightRef.current = false;
      setQuickLoginLoading(false);
    }
  }, [adapter, quickLoginProvider, setSession, setCompanionStatus, shouldShowOnboarding]);

  // 进入登录页先探测一键登录可用性：可用 → 自动拉起授权页；不可用 → 显示密码/验证码界面
  useEffect(() => {
    if (!adapter) return;
    // effect 可能因 adapter/provider 重建而重跑，探测只需一次；
    // 并发探测会让原生单例 helper 的监听器互相覆盖。
    if (quickLoginProbedRef.current) return;
    quickLoginProbedRef.current = true;
    adapter
      .checkQuickLoginAvailable(quickLoginProvider)
      .then((available) => {
        setQuickLoginPhase((phase) =>
          phase === "checking" ? (available ? "ready" : "fallback") : phase,
        );
      })
      .catch(() => {
        setQuickLoginPhase((phase) =>
          phase === "checking" ? "fallback" : phase,
        );
      });
  }, [adapter, quickLoginProvider]);

  // 可用时自动拉起一键登录授权页，只触发一次
  useEffect(() => {
    if (quickLoginPhase !== "ready" || quickLoginStartedRef.current) return;
    quickLoginStartedRef.current = true;
    void runQuickLogin();
  }, [quickLoginPhase, runQuickLogin]);

  const renderQuickLoginLoading = () => (
    <Modal
      transparent
      visible={quickLoginLoading}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={quickLoginLoadingStyles.backdrop}>
        <ActivityIndicator size="large" color="#FE1F4C" />
        <Text style={quickLoginLoadingStyles.label}>正在登录…</Text>
      </View>
    </Modal>
  );

  // 探测一键登录可用性时，避免闪现密码/验证码表单
  if (quickLoginPhase === "checking") {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={quickLoginLoadingStyles.backdrop}>
          <ActivityIndicator size="large" color="#FE1F4C" />
        </View>
      </>
    );
  }

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
            router.replace(resolvePostLoginRoute(String(profile.id), login.register, shouldShowOnboarding));
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
          if (!adapter) {
            showToast("暂无法一键登录，请先配置 SSO client secret。");
            return;
          }
          await runQuickLogin();
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
            router.replace(resolvePostLoginRoute(String(profile.id), login.register, shouldShowOnboarding));
          } catch (error) {
            showToast(
              `登录失败，${error instanceof Error ? error.message : "请检查手机号和验证码"}`,
            );
          }
        }}
      />
      {renderQuickLoginLoading()}
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

const quickLoginLoadingStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  label: {
    marginTop: 16,
    fontSize: 14,
    color: "#999999",
  },
});
