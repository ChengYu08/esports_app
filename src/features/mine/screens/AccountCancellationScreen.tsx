import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { router } from "expo-router";
import Toast from "react-native-root-toast";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { BottomSheet } from "@/shared/ui/BottomSheet";

const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");
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
  const [blockedReasons, setBlockedReasons] = useState<string[] | null>(null);
  const [checkFailureMessage, setCheckFailureMessage] = useState<string | null>(null);
  const [cancellationConfirmVisible, setCancellationConfirmVisible] = useState(false);
  const [verifyVisible, setVerifyVisible] = useState(false);
  const [smsSentVisible, setSmsSentVisible] = useState(false);
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
      Alert.alert("请先登录", "登录后才能申请注销账号。", [
        { text: "取消", style: "cancel" },
        { text: "去登录", onPress: () => router.push("/login") },
      ]);
      return;
    }
    setCancellationConfirmVisible(true);
  };
  const checkCancellation = async () => {
    if (!token || submitting) return;
    setSubmitting(true);
    try {
      const reasons = await clientAuthApi.checkAccountCancellation(token);
      if (reasons.length > 0) {
        setBlockedReasons(reasons);
        return;
      }
      setCode("");
      setVerifyVisible(true);
    } catch (error) {
      setCheckFailureMessage(error instanceof Error ? error.message : "注销状态检查失败，请稍后重试");
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
      setSmsSentVisible(true);
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
      Toast.show("注销申请已提交，账号将在办理期内完成注销，请勿再次登录。", { duration: Toast.durations.SHORT });
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
        <Pressable accessibilityLabel="返回" hitSlop={12} onPress={() => router.back()} style={styles.backButton}><Image source={backIcon} style={styles.backIcon} /></Pressable>
        <Text style={styles.headerTitle}>注销账号</Text><View style={styles.headerSpace} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.card}><Text style={styles.title}>提交前请完整核对</Text><Text style={styles.body}>账号注销不可撤销。平台会结合账号资料、设备状态和使用情况完成核验，符合条件后进入 15 个工作日办理流程。</Text><View style={styles.accountHint}><Text style={styles.accountHintIcon}>{user ? "●" : "○"}</Text><Text style={styles.accountHintText}>{user ? `当前登录账号：${displayPhone}` : "尚未登录，请先登录后再提交注销申请。"}</Text></View></View>
        <Text style={styles.sectionTitle}>注销完成后的影响</Text>
        <View style={styles.card}>{impacts.map(([title, body], index) => <View key={title} style={[styles.infoRow, index > 0 && styles.rowBorder]}><Text style={styles.infoMark}>!</Text><View style={styles.infoCopy}><Text style={styles.infoTitle}>{title}</Text><Text style={styles.infoBody}>{body}</Text></View></View>)}</View>
        <Text style={styles.sectionTitle}>提交前请核对</Text>
        <View style={styles.card}>{requirements.map((item, index) => <View key={item} style={[styles.requirementRow, index > 0 && styles.rowBorder]}><Text style={styles.checkMark}>✓</Text><Text style={styles.requirementText}>{item}</Text></View>)}</View>
        <View style={styles.card}><Text style={styles.sectionTitleInCard}>办理流程</Text>{["阅读说明并核对账号状态", "提交资料并通过短信身份核验", "进入 15 个工作日办理期，期间请勿再次登录", "办理完成，账号及关联资料被删除或匿名化"].map((step, index) => <View key={step} style={styles.stepRow}><Text style={styles.stepIndex}>{String(index + 1).padStart(2, "0")}</Text><Text style={styles.stepText}>{step}</Text></View>)}</View>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} onPress={() => setAgreed((value) => !value)} style={styles.agreementRow}><View style={[styles.checkbox, agreed && styles.checkboxChecked]}>{agreed ? <Text style={styles.checkboxText}>✓</Text> : null}</View><Text style={styles.agreementText}>我已阅读并同意《账号注销说明》，并确认当前账号满足注销条件。</Text></Pressable>
        <Text style={styles.notice}>提交后请在办理期间避免再次登录，重新登录将视为撤回申请。</Text>
        <Pressable accessibilityRole="button" disabled={!agreed || submitting} onPress={handleSubmit} style={[styles.button, (!agreed || submitting) && styles.buttonDisabled]}>{submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>立即注销</Text>}</Pressable>
      </ScrollView>
      <Modal transparent visible={cancellationConfirmVisible} animationType="fade" onRequestClose={() => setCancellationConfirmVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}><Text style={styles.confirmIconText}>!</Text></View>
            <Text style={styles.confirmTitle}>确认申请注销账号吗？</Text>
            <Text style={styles.confirmMessage}>账号注销后将无法恢复，办理周期为 15 个工作日。请确认你已完成相关订单和权益处理。</Text>
            <View style={styles.confirmActions}>
              <Pressable accessibilityRole="button" onPress={() => setCancellationConfirmVisible(false)} style={styles.confirmCancelButton}>
                <Text style={styles.confirmCancelText}>暂不注销</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => { setCancellationConfirmVisible(false); void checkCancellation(); }} style={styles.confirmSubmitButton}>
                <Text style={styles.confirmSubmitText}>继续申请</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={checkFailureMessage !== null} animationType="fade" onRequestClose={() => setCheckFailureMessage(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.failureCard}>
            <View style={styles.failureIcon}><Text style={styles.failureIconText}>!</Text></View>
            <Text style={styles.failureTitle}>检查失败</Text>
            <Text style={styles.failureMessage}>{checkFailureMessage}</Text>
            <View style={styles.failureNotice}>
              <Text style={styles.failureNoticeText}>注销申请尚未提交，你可以稍后重新检查。</Text>
            </View>
            <View style={styles.failureActions}>
              <Pressable accessibilityRole="button" onPress={() => setCheckFailureMessage(null)} style={styles.failureDismissButton}>
                <Text style={styles.failureDismissText}>知道了</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => { setCheckFailureMessage(null); void checkCancellation(); }}
                style={styles.failureRetryButton}
              >
                <Text style={styles.failureRetryText}>重新检查</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={smsSentVisible} animationType="fade" onRequestClose={() => setSmsSentVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.smsSentCard}>
            <View style={styles.smsSentIcon}><Text style={styles.smsSentIconText}>✓</Text></View>
            <Text style={styles.smsSentTitle}>验证码已发送</Text>
            <Text style={styles.smsSentMessage}>短信已发送至绑定手机号</Text>
            <Text style={styles.smsSentPhone}>{displayPhone}</Text>
            <Pressable accessibilityRole="button" onPress={() => setSmsSentVisible(false)} style={styles.smsSentButton}>
              <Text style={styles.smsSentButtonText}>知道了</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={blockedReasons !== null} animationType="fade" onRequestClose={() => setBlockedReasons(null)}><View style={styles.modalBackdrop}><View style={styles.dialogCard}><Text style={styles.dialogTitle}>暂时无法注销账号</Text><Text style={styles.dialogMessage}>你的账号存在以下待处理事项：</Text>{blockedReasons?.map((reason) => <Text key={reason} style={styles.reason}>• {reason}</Text>)}<Pressable onPress={() => setBlockedReasons(null)} style={styles.dialogButton}><Text style={styles.dialogButtonText}>知道了</Text></Pressable></View></View></Modal>
      <BottomSheet keyboardAvoiding scrollable visible={verifyVisible} onClose={() => !submitting && setVerifyVisible(false)} contentStyle={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}><View><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>身份验证</Text><Pressable disabled={submitting} onPress={() => setVerifyVisible(false)}><Text style={styles.closeText}>×</Text></Pressable></View><Text style={styles.verifyPhone}>手机号　{displayPhone}</Text><View style={styles.codeRow}><TextInput autoFocus value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="请输入验证码" placeholderTextColor="#AAA" style={styles.codeInput} /><Pressable disabled={sendingCode || countdown > 0} onPress={() => void sendCode()}><Text style={styles.sendCode}>{sendingCode ? "发送中" : countdown > 0 ? `${countdown}s 后重发` : "获取验证码"}</Text></Pressable></View><Pressable disabled={!code.trim() || submitting} onPress={() => void confirmCancellation()} style={[styles.button, (!code.trim() || submitting) && styles.buttonDisabled]}>{submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>确定注销</Text>}</Pressable></View></BottomSheet>
    </View>
  );
}

function maskPhone(phone?: string) { if (!phone) return "--"; if (phone.length < 7) return phone; return `${phone.slice(0, 3)}****${phone.slice(-4)}`; }
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" }, header: { backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EBEBEB" }, backButton: { width: 28, height: 28, justifyContent: "center" }, backIcon: { width: 24, height: 24, tintColor: "#0A0A0A" }, headerSpace: { width: 28 }, headerTitle: { color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 17, lineHeight: 24, fontWeight: "600" }, content: { padding: 16 }, card: { backgroundColor: "#FFF", borderRadius: 10, padding: 16, marginBottom: 18 }, title: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 18, lineHeight: 25, fontWeight: "700" }, body: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 14, lineHeight: 23, marginTop: 10 }, accountHint: { flexDirection: "row", alignItems: "center", backgroundColor: "#F7F7F7", borderRadius: 8, marginTop: 14, padding: 12 }, accountHintIcon: { color: "#111", fontSize: 15, marginRight: 8 }, accountHintText: { flex: 1, color: "#666", fontFamily: DOUYIN_SANS, fontSize: 13, lineHeight: 20 }, sectionTitle: { color: "#222", fontFamily: DOUYIN_SANS, fontSize: 15, fontWeight: "700", marginBottom: 10 }, infoRow: { flexDirection: "row", paddingVertical: 4 }, rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EEE", paddingTop: 14, marginTop: 12 }, infoMark: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#FFF0F2", color: "#FF1F4C", textAlign: "center", lineHeight: 22, fontWeight: "700", marginRight: 10 }, infoCopy: { flex: 1 }, infoTitle: { color: "#222", fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "600" }, infoBody: { color: "#777", fontFamily: DOUYIN_SANS, fontSize: 12, lineHeight: 20, marginTop: 3 }, requirementRow: { flexDirection: "row", alignItems: "center", minHeight: 34 }, checkMark: { color: "#18A058", fontSize: 17, fontWeight: "700", marginRight: 10 }, requirementText: { flex: 1, color: "#555", fontFamily: DOUYIN_SANS, fontSize: 13, lineHeight: 20 }, sectionTitleInCard: { color: "#222", fontFamily: DOUYIN_SANS, fontSize: 15, fontWeight: "700", marginBottom: 12 }, stepRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 }, stepIndex: { color: "#FF1F4C", fontFamily: DOUYIN_SANS, fontSize: 12, fontWeight: "700", width: 30 }, stepText: { flex: 1, color: "#555", fontFamily: DOUYIN_SANS, fontSize: 13, lineHeight: 20 }, agreementRow: { flexDirection: "row", alignItems: "flex-start", marginHorizontal: 2 }, checkbox: { width: 21, height: 21, borderWidth: 1, borderColor: "#CCC", borderRadius: 4, alignItems: "center", justifyContent: "center", marginRight: 8, marginTop: 1 }, checkboxChecked: { backgroundColor: "#FF1F4C", borderColor: "#FF1F4C" }, checkboxText: { color: "#FFF", fontSize: 14, fontWeight: "700" }, agreementText: { flex: 1, color: "#666", fontFamily: DOUYIN_SANS, fontSize: 13, lineHeight: 20 }, notice: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 12, lineHeight: 19, marginTop: 10, marginHorizontal: 2 }, button: { height: 46, borderRadius: 8, backgroundColor: "#FF1F4C", alignItems: "center", justifyContent: "center", marginTop: 18 }, buttonDisabled: { opacity: 0.4 }, buttonText: { color: "#FFF", fontFamily: DOUYIN_SANS, fontSize: 15, fontWeight: "600" }, modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }, confirmCard: { backgroundColor: "#FFF", borderRadius: 16, padding: 24, alignItems: "center" }, confirmIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#FFF0F2", alignItems: "center", justifyContent: "center", marginBottom: 14 }, confirmIconText: { color: "#FF1F4C", fontSize: 25, lineHeight: 28, fontWeight: "700" }, confirmTitle: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 18, lineHeight: 25, fontWeight: "700", textAlign: "center" }, confirmMessage: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 13, lineHeight: 21, marginTop: 10, textAlign: "center" }, confirmActions: { flexDirection: "row", width: "100%", gap: 10, marginTop: 22 }, confirmCancelButton: { flex: 1, height: 44, borderRadius: 8, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center" }, confirmCancelText: { color: "#555", fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "600" }, confirmSubmitButton: { flex: 1, height: 44, borderRadius: 8, backgroundColor: "#FF1F4C", alignItems: "center", justifyContent: "center" }, confirmSubmitText: { color: "#FFF", fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "600" }, dialogCard: { backgroundColor: "#FFF", borderRadius: 12, padding: 22 }, dialogTitle: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 17, fontWeight: "700" }, dialogMessage: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 13, marginTop: 10, marginBottom: 8 }, reason: { color: "#555", fontFamily: DOUYIN_SANS, fontSize: 13, lineHeight: 22 }, dialogButton: { height: 44, backgroundColor: "#FF1F4C", borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 18 }, dialogButtonText: { color: "#FFF", fontFamily: DOUYIN_SANS, fontSize: 15, fontWeight: "600" }, sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }, sheet: { backgroundColor: "#FFF", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 }, sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sheetTitle: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 18, fontWeight: "700" }, closeText: { color: "#888", fontSize: 28, lineHeight: 28 }, verifyPhone: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 14, marginTop: 18 }, codeRow: { height: 48, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#DDD", marginTop: 12 }, codeInput: { flex: 1, color: "#111", fontFamily: DOUYIN_SANS, fontSize: 15 }, sendCode: { color: "#FF1F4C", fontFamily: DOUYIN_SANS, fontSize: 13 },
  failureCard: { width: "100%", maxWidth: 360, borderRadius: 16, padding: 24, alignItems: "center", backgroundColor: "#FFF" }, failureIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF0F2", marginBottom: 14 }, failureIconText: { color: "#FF1F4C", fontFamily: DOUYIN_SANS, fontSize: 26, lineHeight: 30, fontWeight: "700" }, failureTitle: { color: "#111216", fontFamily: DOUYIN_SANS, fontSize: 18, lineHeight: 25, fontWeight: "700" }, failureMessage: { alignSelf: "stretch", color: "#666", fontFamily: DOUYIN_SANS, fontSize: 13, lineHeight: 21, textAlign: "center", marginTop: 10 }, failureNotice: { alignSelf: "stretch", borderRadius: 8, backgroundColor: "#F7F7F7", paddingHorizontal: 12, paddingVertical: 10, marginTop: 16 }, failureNoticeText: { color: "#888", fontFamily: DOUYIN_SANS, fontSize: 12, lineHeight: 18, textAlign: "center" }, failureActions: { alignSelf: "stretch", flexDirection: "row", gap: 10, marginTop: 20 }, failureDismissButton: { flex: 1, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#F2F2F2" }, failureDismissText: { color: "#555", fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "600" }, failureRetryButton: { flex: 1, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#FF1F4C" }, failureRetryText: { color: "#FFF", fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "600" },
  smsSentCard: { width: "100%", maxWidth: 360, borderRadius: 16, padding: 24, alignItems: "center", backgroundColor: "#FFF" }, smsSentIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF8F0", marginBottom: 14 }, smsSentIconText: { color: "#18A058", fontFamily: DOUYIN_SANS, fontSize: 24, lineHeight: 29, fontWeight: "700" }, smsSentTitle: { color: "#111216", fontFamily: DOUYIN_SANS, fontSize: 18, lineHeight: 25, fontWeight: "700" }, smsSentMessage: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 13, lineHeight: 20, marginTop: 10 }, smsSentPhone: { color: "#222", fontFamily: DOUYIN_SANS, fontSize: 15, lineHeight: 22, fontWeight: "600", marginTop: 4 }, smsSentButton: { alignSelf: "stretch", height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#FF1F4C", marginTop: 22 }, smsSentButtonText: { color: "#FFF", fontFamily: DOUYIN_SANS, fontSize: 14, fontWeight: "600" },
});
