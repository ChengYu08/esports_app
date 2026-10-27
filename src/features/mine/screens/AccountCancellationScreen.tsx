import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";
import Toast from "react-native-root-toast";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { clientAuthApi } from "@/features/auth/client-auth.api";
import { clearAuthSession } from "@/features/auth/session-persistence";
import { messageStore } from "@/features/message/message-store";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { useAppConfirm } from "@/shared/ui/app-confirm";
import { BottomSheet } from "@/shared/ui/BottomSheet";

const impacts = [
  ["账号完成注销后无法恢复", "注销完成后，当前账号不能再登录，原账号及关联资料也不能恢复。"],
  ["历史信息会被删除或匿名化", "个人资料、绑定资料、聊天和核验记录会按规则删除或匿名化。"],
  ["相关服务和协议将一并结束", "账号关联的服务、权限和协议关系会同步结束，请提前保存需要的资料。"],
] as const;
const requirements = [
  "账号由本人合法持有并正在使用",
  "账号当前安全且状态正常，不存在封禁、禁用或盗用风险",
  "不存在在售商品、未完成订单或待处理事项",
  "账号相关收益和财产权益已处理完毕",
  "未涉及投诉举报、调查仲裁或其他争议",
];

export default function AccountCancellationScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.accessToken);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifyVisible, setVerifyVisible] = useState(false);
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((value) => Math.max(value - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const displayPhone = useMemo(() => maskPhone(user?.phone), [user?.phone]);
  const handleSubmit = () => {
    if (!token) {
      void (async () => {
        const goLogin = await useAppConfirm.getState().confirm({
          title: "请先登录",
          message: "登录后才能申请注销账号。",
          cancelText: "取消",
          confirmText: "去登录",
        });
        if (goLogin) router.push("/login");
      })();
      return;
    }
    void (async () => {
      const confirmed = await useAppConfirm.getState().confirm({
        title: "确认申请注销账号吗？",
        message:
          "账号注销后将无法恢复，办理周期为 15 个工作日。请确认你已完成相关订单和权益处理。",
        cancelText: "暂不注销",
        confirmText: "继续申请",
      });
      if (confirmed) void checkCancellation();
    })();
  };
  const checkCancellation = async () => {
    if (!token || submitting) return;
    setSubmitting(true);
    try {
      const reasons = await clientAuthApi.checkAccountCancellation(token);
      if (reasons.length > 0) {
        void useAppConfirm.getState().confirm({
          title: "暂时无法注销账号",
          message: `你的账号存在以下待处理事项：\n${reasons.map((reason) => `• ${reason}`).join("\n")}`,
        });
        return;
      }
      setCode("");
      setVerifyVisible(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "注销状态检查失败，请稍后重试";
      const retry = await useAppConfirm.getState().confirm({
        title: "检查失败",
        message: `${message}\n\n注销申请尚未提交，你可以稍后重新检查。`,
        cancelText: "知道了",
        confirmText: "重新检查",
      });
      if (retry) void checkCancellation();
    } finally {
      setSubmitting(false);
    }
  };
  const sendCode = async () => {
    if (!token || sendingCode || countdown > 0) return;
    setSendingCode(true);
    try {
      await clientAuthApi.sendAccountCancellationSms(token);
      setCountdown(60);
      void useAppConfirm.getState().confirm({
        title: "验证码已发送",
        message: `短信已发送至绑定手机号\n${displayPhone}`,
      });
    } catch (error) {
      Toast.show(
        `验证码发送失败，${error instanceof Error ? error.message : "请稍后重试"}`,
        { duration: Toast.durations.SHORT },
      );
    } finally {
      setSendingCode(false);
    }
  };
  const confirmCancellation = async () => {
    const smsCode = code.trim();
    if (!token || smsCode.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      await clientAuthApi.cancelAccount(token, smsCode);
      setVerifyVisible(false);
      await clearAuthSession().catch(() => undefined);
      clearSession();
      await messageStore.getState().reset().catch(() => undefined);
      Toast.show("注销申请已提交，账号将在办理期内完成注销，请勿再次登录。", {
        duration: Toast.durations.SHORT,
      });
      router.replace("/");
    } catch (error) {
      Toast.show(
        `注销申请失败，${error instanceof Error ? error.message : "请检查验证码后重试"}`,
        { duration: Toast.durations.SHORT },
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { height: 44 + insets.top, paddingTop: insets.top }]}>
        <Pressable
          accessibilityLabel="返回"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ChevronLeft24Regular color="#0A0A0A" width={24} height={24} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>注销账号</Text>
        <View style={styles.headerSpace} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.title}>提交前请完整核对</Text>
          <Text style={styles.body}>
            账号注销不可撤销。平台会结合账号资料、设备状态和使用情况完成核验，符合条件后进入 15
            个工作日办理流程。
          </Text>
          <View style={styles.accountHint}>
            <Text style={styles.accountHintIcon}>{user ? "●" : "○"}</Text>
            <Text style={styles.accountHintText}>
              {user
                ? `当前登录账号：${displayPhone}`
                : "尚未登录，请先登录后再提交注销申请。"}
            </Text>
          </View>
        </View>
        <Text style={styles.sectionTitle}>注销完成后的影响</Text>
        <View style={styles.card}>
          {impacts.map(([title, body], index) => (
            <View key={title} style={[styles.infoRow, index > 0 && styles.rowBorder]}>
              <Text style={styles.infoMark}>!</Text>
              <View style={styles.infoCopy}>
                <Text style={styles.infoTitle}>{title}</Text>
                <Text style={styles.infoBody}>{body}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.sectionTitle}>提交前请核对</Text>
        <View style={styles.card}>
          {requirements.map((item, index) => (
            <View
              key={item}
              style={[styles.requirementRow, index > 0 && styles.rowBorder]}
            >
              <Text style={styles.checkMark}>✓</Text>
              <Text style={styles.requirementText}>{item}</Text>
            </View>
          ))}
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitleInCard}>办理流程</Text>
          {[
            "阅读说明并核对账号状态",
            "提交资料并通过短信身份核验",
            "进入 15 个工作日办理期，期间请勿再次登录",
            "办理完成，账号及关联资料被删除或匿名化",
          ].map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <Text style={styles.stepIndex}>{String(index + 1).padStart(2, "0")}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          onPress={() => setAgreed((value) => !value)}
          style={styles.agreementRow}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed ? <Text style={styles.checkboxText}>✓</Text> : null}
          </View>
          <Text style={styles.agreementText}>
            我已阅读并同意《账号注销说明》，并确认当前账号满足注销条件。
          </Text>
        </Pressable>
        <Text style={styles.notice}>
          提交后请在办理期间避免再次登录，重新登录将视为撤回申请。
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={!agreed || submitting}
          onPress={handleSubmit}
          style={[styles.button, (!agreed || submitting) && styles.buttonDisabled]}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>立即注销</Text>
          )}
        </Pressable>
      </ScrollView>
      <BottomSheet
        keyboardAvoiding
        scrollable
        visible={verifyVisible}
        onClose={() => !submitting && setVerifyVisible(false)}
        contentStyle={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}
      >
        <View>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>身份验证</Text>
            <Pressable disabled={submitting} onPress={() => setVerifyVisible(false)}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.verifyPhone}>手机号　{displayPhone}</Text>
          <View style={styles.codeRow}>
            <TextInput
              autoFocus
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="请输入验证码"
              placeholderTextColor="#AAA"
              style={styles.codeInput}
            />
            <Pressable
              disabled={sendingCode || countdown > 0}
              onPress={() => void sendCode()}
            >
              <Text style={styles.sendCode}>
                {sendingCode
                  ? "发送中"
                  : countdown > 0
                    ? `${countdown}s 后重发`
                    : "获取验证码"}
              </Text>
            </Pressable>
          </View>
          <Pressable
            disabled={!code.trim() || submitting}
            onPress={() => void confirmCancellation()}
            style={[
              styles.button,
              (!code.trim() || submitting) && styles.buttonDisabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>确定注销</Text>
            )}
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
}

function maskPhone(phone?: string) {
  if (!phone) return "--";
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  header: {
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EBEBEB",
  },
  backButton: { width: 28, height: 28, justifyContent: "center" },
  backIcon: { width: 24, height: 24 },
  headerSpace: { width: 28 },
  headerTitle: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
  },
  content: { padding: 16 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 10,
    padding: 16,
    marginBottom: 18,
  },
  title: {
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "700",
  },
  body: {
    color: "#666",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 23,
    marginTop: 10,
  },
  accountHint: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F7F7",
    borderRadius: 8,
    marginTop: 14,
    padding: 12,
  },
  accountHintIcon: { color: "#111", fontSize: 15, marginRight: 8 },
  accountHintText: {
    flex: 1,
    color: "#666",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    lineHeight: 20,
  },
  sectionTitle: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },
  infoRow: { flexDirection: "row", paddingVertical: 4 },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#EEE",
    paddingTop: 14,
    marginTop: 12,
  },
  infoMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFF0F2",
    color: "#FF1F4C",
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "700",
    marginRight: 10,
  },
  infoCopy: { flex: 1 },
  infoTitle: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
  },
  infoBody: {
    color: "#777",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 3,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 34,
  },
  checkMark: {
    color: "#18A058",
    fontSize: 17,
    fontWeight: "700",
    marginRight: 10,
  },
  requirementText: {
    flex: 1,
    color: "#555",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    lineHeight: 20,
  },
  sectionTitleInCard: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  stepRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  stepIndex: {
    color: "#FF1F4C",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "700",
    width: 30,
  },
  stepText: {
    flex: 1,
    color: "#555",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    lineHeight: 20,
  },
  agreementRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 2,
  },
  checkbox: {
    width: 21,
    height: 21,
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: "#FF1F4C", borderColor: "#FF1F4C" },
  checkboxText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  agreementText: {
    flex: 1,
    color: "#666",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    lineHeight: 20,
  },
  notice: {
    color: "#999",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 10,
    marginHorizontal: 2,
  },
  button: {
    height: 46,
    borderRadius: 8,
    backgroundColor: "#FF1F4C",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: {
    color: "#FFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
    fontWeight: "600",
  },
  sheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 18,
    fontWeight: "700",
  },
  closeText: { color: "#888", fontSize: 28, lineHeight: 28 },
  verifyPhone: {
    color: "#666",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    marginTop: 18,
  },
  codeRow: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#DDD",
    marginTop: 12,
  },
  codeInput: { flex: 1, color: "#111", fontFamily: DOUYIN_SANS, fontSize: 15 },
  sendCode: { color: "#FF1F4C", fontFamily: DOUYIN_SANS, fontSize: 13 },
});
