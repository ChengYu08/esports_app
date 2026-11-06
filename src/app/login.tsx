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
import { getPasswordLoginErrorMessage } from "@/features/auth/password-login-error";
import { openInAppWebView } from "@/shared/navigation/open-web-view";
import { backAfterLogin } from "@/shared/navigation/require-login";
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
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { showToast } from "@/shared/ui/app-toast";

export default function LoginRoute() {
  const params = useLocalSearchParams<{ mode?: string; phone?: string }>();
  const initialMode = params.mode === "password" ? "password" : "sms";
  const initialPhone = typeof params.phone === "string" ? params.phone : "";
  const setSession = useAuthStore((state) => state.setSession);
  const setCompanionStatus = useAuthStore((state) => state.setCompanionStatus);
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
            referer: env.referer,
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
      // push 进来的场景退回来源页；Tab 等 replace 进来的场景没有可退页面，回首页
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          backAfterLogin();
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
          // 只在带入的手机号命中注销记录时才主动弹窗，
          // 否则换账号登录的用户会被别人的冷静期提示打断
          if (initialPhone && record.phone === initialPhone) {
            setCoolingDialogVisible(true);
          }
        } else {
          setCoolingRecord(null);
        }
      });
      return () => {
        active = false;
      };
    }, [initialPhone]),
  );

  // 冷静期只对注销的那个手机号生效，其他账号在同一台设备上登录不受影响
  const ensureNotCooling = (phone?: string) => {
    if (!coolingRecord) {
      return true;
    }
    if (phone && phone !== coolingRecord.phone) {
      return true;
    }
    setCoolingDialogVisible(true);
    return false;
  };

  // 登录成功即视为取消注销（服务端侧已取消），本地冷静期记录要同步清掉，
  // 否则下次回到登录页还会按未失效的记录继续弹冷静期弹窗
  const clearCoolingIfMatched = useCallback(
    async (phone?: string) => {
      if (!coolingRecord || !phone || phone !== coolingRecord.phone) {
        return;
      }
      await clearCoolingRecord();
      setCoolingRecord(null);
    },
    [coolingRecord],
  );

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
    // 成功路径不手动关遮罩：router.back()/replace() 只是派发导航，转场动画还有几百毫秒，
    // 此时立刻撤遮罩会露出底下的密码表单，像跳错了页面。登录页卸载时 Modal 自然消失。
    let keepOverlayUntilUnmount = false;
    try {
      const token = await adapter.authorizeQuickLogin(quickLoginProvider);
      // 一键登录的手机号在授权前拿不到，只能拿到 token 后再校验冷静期；
      // 只拦注销的那个号码，换卡/换账号不受影响
      if (
        isCoolingActive(coolingRecord) &&
        coolingRecord.phone === token.phone
      ) {
        setCoolingDialogVisible(true);
        setQuickLoginPhase("fallback");
        return;
      }
      await completeClientLogin(
        token,
        "ONE_CLICK_LOGIN",
        setSession,
        setCompanionStatus,
        token.phone,
      );
      await clearCoolingIfMatched(token.phone);
      backAfterLogin();
      keepOverlayUntilUnmount = true;
    } catch (error) {
      // 用户在授权页主动退出，授权页盖在登录页之上，关掉后自然露出下面的界面。
      // switch：点了「验证码或密码登录」，露出下面的密码/验证码表单，静默即可；
      // exit：点了返回按钮/返回键，退出登录页回首页。
      if (error instanceof QuickLoginCancelledError) {
        console.warn("[DEBUG-QUICK-LOGIN] cancelled", { reason: error.reason });
        // 取消后落到表单态：phase 不再是 ready，回到登录页不会又自动拉起授权页
        setQuickLoginPhase("fallback");
        if (error.reason === "exit") {
          backAfterLogin();
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
      if (!keepOverlayUntilUnmount) {
        setQuickLoginLoading(false);
      }
    }
  }, [adapter, quickLoginProvider, setSession, setCompanionStatus, coolingRecord, clearCoolingIfMatched]);

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
    if (quickLoginPhase !== "ready" || quickLoginStartedRef.current) {
      return;
    }
    quickLoginStartedRef.current = true;
    runQuickLogin();
  }, [quickLoginPhase, runQuickLogin]);

  const renderQuickLoginCover = () => {
    const visible = quickLoginPhase === "ready" || quickLoginLoading;
    if (!visible) {
      return null;
    }
    return (
      <View
        accessibilityViewIsModal
        pointerEvents="auto"
        style={quickLoginLoadingStyles.cover}
      >
        <ActivityIndicator size="large" color="#FE1F4C" />
        <Text style={quickLoginLoadingStyles.label}>正在登录…</Text>
      </View>
    );
  };

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
      <View style={quickLoginLoadingStyles.route}>
        <LoginScreen
          initialMode={initialMode}
          initialPhone={initialPhone}
          onBack={backAfterLogin}
          onSkip={backAfterLogin}
          onSendCode={async (phone) => {
            if (!ensureNotCooling(phone)) {
              // 冷静期弹窗已展示，必须让 Promise 失败，
              // 否则 LoginScreen 会当作发送成功进入 60s 倒计时
              throw new Error("账号处于注销冷静期");
            }
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
            if (!ensureNotCooling(payload.username)) {
              return;
            }
            if (!adapter) {
              setPasswordLoginError("请先配置 SSO client secret。");
              return;
            }
            try {
              const token = await adapter.passwordLogin(payload);
              await completeClientLogin(
                token,
                "PASSWORD",
                setSession,
                setCompanionStatus,
                payload.username,
              );
              await clearCoolingIfMatched(payload.username);
              backAfterLogin();
            } catch (error) {
              setPasswordLoginError(getPasswordLoginErrorMessage(error));
            }
          }}
          onForgotPassword={(phone) =>
            router.push({ pathname: "/forgot-password", params: { phone } })
          }
          onUserAgreementPress={() =>
            openInAppWebView(APP_LINKS.userAgreement, "用户协议")
          }
          onPrivacyPolicyPress={() =>
            openInAppWebView(APP_LINKS.privacyPolicy, "隐私政策")
          }
          onQuickLogin={async () => {
            if (!adapter) {
              showToast("暂无法一键登录，请先配置 SSO client secret。");
              return;
            }
            await runQuickLogin();
          }}
          onLogin={async (payload) => {
            if (!ensureNotCooling(payload.phone)) {
              return;
            }
            if (!adapter) {
              showToast("登录失败，请先配置 SSO client secret。");
              return;
            }
            try {
              const token = await adapter.login(payload);
              await completeClientLogin(
                token,
                "SMS_CODE",
                setSession,
                setCompanionStatus,
                payload.phone,
              );
              await clearCoolingIfMatched(payload.phone);
              backAfterLogin();
            } catch (error) {
              showToast(
                `登录失败，${error instanceof Error ? error.message : "请检查手机号和验证码"}`,
              );
            }
          }}
        />
        {renderQuickLoginCover()}
      </View>
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
  route: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cover: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    elevation: 100,
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
