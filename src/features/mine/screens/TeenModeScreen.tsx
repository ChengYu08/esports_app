import { Image } from "expo-image";
import { router } from "expo-router";
import { showToast, toastDurations } from "@/shared/ui/app-toast";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuthStore } from "@esports/auth";

import {
  TEEN_MODE_PASSWORD_LENGTH,
  filterDigits,
  isPasswordComplete,
} from "@/features/mine/teen-mode";
import {
  teenModeApi,
} from "@/features/mine/api/teen-mode.api";
import type { TeenModeStatus } from "@/features/mine/api/teen-mode.contract";
import { saveLastTeenEnabled } from "@/features/mine/teen-mode-store";
import { colors } from "@/shared/theme/tokens";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");
const closedIllustration = require("../../../../assets/mine/figma/teen-mode-closed.svg");
const openIllustration = require("../../../../assets/mine/figma/teen-mode-open.svg");
const starIcon = require("../../../../assets/mine/figma/teen-mode-star.svg");

type Phase =
  | "overview"
  | "setFirst"
  | "setConfirm"
  | "openWithPassword"
  | "openWithPasswordConfirm"
  | "disable";

type PasswordPhase = Exclude<Phase, "overview">;

export default function TeenModeScreen({
  onStatusChanged,
  locked = false,
}: {
  /** 每次服务端状态变化后回调（启动门禁据此解除锁定覆盖层）。 */
  onStatusChanged?: (status: TeenModeStatus) => void;
  /** 作为启动门禁锁定页使用：隐藏返回键，用户必须输密码关闭才能离开。 */
  locked?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const token = useAuthStore((state) => state.accessToken);
  const [status, setStatus] = useState<TeenModeStatus | null>(null);
  const [phase, setPhase] = useState<Phase>("overview");
  const [code, setCode] = useState("");
  const [firstPassword, setFirstPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const enabled = status?.enabled === true;
  const passwordSet = status?.passwordSet === true;

  const applyStatus = (next: TeenModeStatus) => {
    setStatus(next);
    void saveLastTeenEnabled(next.enabled);
    onStatusChanged?.(next);
  };

  // 挂载即拉取服务端状态；拉取失败保持当前视图（fail-open，不阻断页面）
  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const next = await teenModeApi.status(token);
        if (cancelled) {
          return;
        }
        applyStatus(next);
      } catch {
        // 状态拉取失败保持当前视图，避免网络抖动导致页面不可用
      }
    })();
    return () => {
      cancelled = true;
    };
    // applyStatus 依赖 token/user，本 effect 仅随登录态变化重新拉取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const codeComplete = isPasswordComplete(code);

  const confirmCode = () => {
    if (!codeComplete || submitting || !token) {
      return;
    }
    if (phase === "setFirst") {
      setFirstPassword(code);
      setCode("");
      setPhase("setConfirm");
      return;
    }
    setSubmitting(true);
    void (async () => {
      try {
        if (phase === "setConfirm") {
          if (code !== firstPassword) {
            showToast("前后两次密码不一致");
            setCode("");
            setFirstPassword("");
            setPhase("setFirst");
            return;
          }
          // 未设过密码：open 同时完成「设置密码 + 开启」
          applyStatus(await teenModeApi.open(token, code, code));
          setPhase("overview");
          showToast("青少年模式已开启");
          return;
        }
        if (
          phase === "openWithPasswordConfirm"
        ) {
          // 已设过密码：两次输入一致后，校验密码并开启
          if (code !== firstPassword) {
            showToast("前后两次密码不一致");
            setCode("");
            setFirstPassword("");
            setPhase("openWithPassword");
            return;
          }
          applyStatus(await teenModeApi.open(token, code));
          setPhase("overview");
          showToast("青少年模式已开启");
          return;
        }
        if (phase === "disable") {
          // 关闭青少年模式：单次输入，密码正确性由服务端校验
          applyStatus(await teenModeApi.close(token, code));
          setPhase("overview");
          showToast("青少年模式已关闭");
          return;
        }
      } catch (error) {
        // 密码错误等信息需要用户明确看到，使用长时长提示
        showToast(
          error instanceof Error ? error.message : "操作失败，请稍后重试",
          { duration: toastDurations.LONG },
        );
        setCode("");
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const renderOverview = () => (
    <>
      <View style={styles.overviewContent}>
        <Image
          accessibilityLabel={enabled ? "青少年模式已开启插画" : "青少年模式未开启插画"}
          source={enabled ? openIllustration : closedIllustration}
          style={styles.illustration}
        />
        <View style={styles.overviewText}>
          <Text style={styles.overviewTitle}>
            {enabled ? "青少年模式已开启" : "青少年模式未开启"}
          </Text>
          {enabled ? (
            <>
              <View style={styles.bulletRow}>
                <Image source={starIcon} style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  青少年模式开启中，您无法使用盼之电竞核心功能
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Image source={starIcon} style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  我们将持续进行深度探索与迭代优化，不断拓展场景适配能力
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Image source={starIcon} style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  为保障未成年人的充足休息与健康作息，开启未成年人模式后，晚10点至次日早6点期间无法访问盼之社区
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.bulletRow}>
                <Image source={starIcon} style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  未成年人模式是盼之电竞为促进青少年健康成长做出的一次尝试，开启青少年模式后，未成年用户将无法使用盼之电竞核心功能
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Image source={starIcon} style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  开启青少年模式，
                  <Text style={styles.bulletHighlight}>需先设置独立密码</Text>
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
      {enabled ? (
        <Text style={styles.noticeText}>
          {"可在“设置”中查看未成年人模式"}
        </Text>
      ) : null}
      <View style={[styles.bottomBar, { paddingBottom: 24 + insets.bottom }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={enabled ? "关闭青少年模式" : "开启青少年模式"}
          onPress={
            enabled
              ? () => {
                  setCode("");
                  setPhase("disable");
                }
              : () => {
                  setCode("");
                  setFirstPassword("");
                  // 已设过密码：开启仅需输入密码校验；未设过：进入设置密码页
                  setPhase(passwordSet ? "openWithPassword" : "setFirst");
                }
          }
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>
            {enabled ? "关闭青少年模式" : "开启青少年模式"}
          </Text>
        </Pressable>
      </View>
    </>
  );

  const renderPassword = () => {
    // 进入密码输入视图时 phase 必然是四个密码子阶段之一
    const passwordPhase = phase as PasswordPhase;
    const titles: Record<PasswordPhase, string> = {
      setFirst: "设置密码",
      setConfirm: "再次输入密码",
      openWithPassword: "输入密码",
      openWithPasswordConfirm: "再次输入密码",
      // 设计稿 274-47290：关闭页标题与副标题用词不同
      disable: "关闭青少年模式",
    };
    // 设计稿 274-47290：关闭页副标题为“解锁未成年人模式”，其余阶段为“解锁青少年模式”
    // 关闭流程：整页只保留标题，无副标题与小文案
    const subtitle =
      passwordPhase === "disable" ? null : "该密码将用于解锁青少年模式";
    const centered = passwordPhase === "disable";
    return (
      <View style={styles.passwordContent}>
        <View style={styles.passwordBody}>
          <View
            style={[
              styles.passwordTitleWrap,
              centered && styles.passwordTitleWrapCentered,
            ]}
          >
            <Text style={styles.passwordTitle}>{titles[passwordPhase]}</Text>
            {subtitle ? (
              <Text style={styles.passwordSubtitle}>{subtitle}</Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => inputRef.current?.focus()}
            style={styles.boxesRow}
          >
            {Array.from({ length: TEEN_MODE_PASSWORD_LENGTH }, (_, index) => {
              const digit = code[index];
              const active = code.length === index;
              return (
                <View key={index} style={styles.passwordBox}>
                  {digit ? (
                    <View style={styles.boxDot} />
                  ) : active ? (
                    <View style={styles.boxCursor} />
                  ) : null}
                </View>
              );
            })}
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={(value) => {
                const next = filterDigits(value);
                setCode(next);
                // 任一密码输入阶段：输满 4 位自动进入“再次输入密码”
                if (isPasswordComplete(next)) {
                  if (phase === "setFirst") {
                    setFirstPassword(next);
                    setCode("");
                    setPhase("setConfirm");
                  } else if (phase === "openWithPassword") {
                    setFirstPassword(next);
                    setCode("");
                    setPhase("openWithPasswordConfirm");
                  }
                }
              }}
              keyboardType="number-pad"
              maxLength={TEEN_MODE_PASSWORD_LENGTH}
              autoFocus
              caretHidden
              style={styles.hiddenInput}
            />
          </Pressable>
          {/* 确认按钮位于输入框正下方（设计稿 274-46247/46328） */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="确认"
            disabled={!codeComplete || submitting}
            onPress={() => void confirmCode()}
            style={[
              styles.primaryButton,
              styles.confirmInFlow,
              (!codeComplete || submitting) && styles.primaryButtonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>确认</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          { height: 44 + insets.top, paddingTop: insets.top },
        ]}
      >
        {locked ? (
          <View style={styles.backButton} />
        ) : (
          <Pressable
            accessibilityLabel="返回"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Image source={backIcon} style={styles.backIcon} />
          </Pressable>
        )}
        <View style={styles.headerEnd} />
      </View>
      {status === null ? null : phase === "overview"
        ? renderOverview()
        : renderPassword()}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF" },
  header: {
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 48,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { width: 24, height: 24, tintColor: "#0A0A0A" },
  headerEnd: { width: 16 },
  overviewContent: {
    flex: 1,
    padding: 32,
    gap: 32,
    alignItems: "center",
  },
  illustration: { width: 311, height: 133 },
  overviewText: { alignSelf: "stretch", gap: 12 },
  overviewTitle: {
    color: "#333333",
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
  },
  bulletRow: {
    flexDirection: "row",
    gap: 10,
  },
  bulletIcon: { width: 14, height: 14, marginTop: 5 },
  bulletText: {
    flex: 1,
    color: "#666666",
    fontSize: 14,
    lineHeight: 24,
  },
  bulletHighlight: { color: colors.brand },
  bottomBar: {
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  primaryButton: {
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  // 密码页确认按钮：紧跟输入框下方（设计稿 274-46247/46328）
  confirmInFlow: { marginTop: 24 },
  primaryButtonDisabled: { backgroundColor: "#FF708D" },
  primaryButtonText: {
    color: "#FFF",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  passwordContent: { flex: 1 },
  passwordBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 24,
  },
  passwordTitleWrap: { alignItems: "flex-start", gap: 4 },
  passwordTitleWrapCentered: { alignItems: "center" },
  passwordTitle: {
    color: "#333333",
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
  },
  passwordSubtitle: {
    color: "#999999",
    fontSize: 14,
    lineHeight: 24,
  },
  boxesRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  passwordBox: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    alignItems: "center",
    justifyContent: "center",
  },
  boxDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#0A0A0A",
  },
  boxCursor: {
    width: 3,
    height: 28,
    borderRadius: 1.5,
    // 设计稿 274-46328：光标为红色
    backgroundColor: "#FE1F4C",
  },
  noticeText: {
    color: "#999999",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    paddingBottom: 12,
  },
  hiddenInput: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0,
  },
});
