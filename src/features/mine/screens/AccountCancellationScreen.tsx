import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { router } from "expo-router";
import { showToast, toastDurations } from "@/shared/ui/app-toast";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { APP_LINKS } from "@/core/config/links";
import { clientAuthApi } from "@/features/auth/client-auth.api";
import {
  buildCoolingRecord,
  formatCoolEndTime,
  parseCoolEndTime,
} from "@/features/auth/cancellation-cooling";
import { saveCoolingRecord } from "@/features/auth/cancellation-cooling-store";
import { clearAuthSession } from "@/features/auth/session-persistence";
import { messageStore } from "@/features/message/message-store";
import { leaveVoiceRtc } from "@/features/voice-room/voice-room-rtc";
import { leaveVoiceChatRoom } from "@/features/voice-room/voice-room-rongcloud";
import { useVoiceRoomSessionStore } from "@/features/voice-room/voice-room-session";
import { colors } from "@/shared/theme/tokens";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { openExternalLink } from "@/shared/navigation/open-external-link";
import { AppPrompt } from "@/shared/ui/AppPrompt";
import { BottomSheet } from "@/shared/ui/BottomSheet";

const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");
const closeIcon = require("../../../../assets/svgs/icon-close.svg");

const DEFAULT_COOLING_DAYS = 15;

export default function AccountCancellationScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.accessToken);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [agreed, setAgreed] = useState(false);
  const [applying, setApplying] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [coolingDays, setCoolingDays] = useState(DEFAULT_COOLING_DAYS);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(
      () => setCountdown((value) => Math.max(value - 1, 0)),
      1000,
    );
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (!token) return;
    clientAuthApi
      .queryCancellationStatus(token)
      .then((status) => {
        if (status.coolingDays && status.coolingDays > 0) {
          setCoolingDays(status.coolingDays);
        }
      })
      .catch(() => undefined);
  }, [token]);

  const maskedPhone = maskPhone(user?.phone);

  const openVerifySheet = () => {
    if (!token) {
      Alert.alert("请先登录", "登录后才能申请注销账号。", [
        { text: "取消", style: "cancel" },
        { text: "去登录", onPress: () => router.push("/login") },
      ]);
      return;
    }
    setVerifyError(null);
    setCode("");
    setSheetVisible(true);
  };

  const applyCancellation = async () => {
    if (!token || applying) return;
    setApplying(true);
    try {
      await clientAuthApi.applyCancellation(token);
      openVerifySheet();
    } catch (error) {
      setBlockedMessage(
        error instanceof Error && error.message
          ? error.message
          : "暂时无法注销，请稍后重试",
      );
    } finally {
      setApplying(false);
    }
  };

  const sendCode = async () => {
    if (!token || sendingCode || countdown > 0) return;
    setSendingCode(true);
    try {
      await clientAuthApi.sendAccountCancellationSms(token);
      setCountdown(60);
    } catch (error) {
      showToast(
        `验证码发送失败，${error instanceof Error ? error.message : "请稍后重试"}`,
      );
    } finally {
      setSendingCode(false);
    }
  };

  const confirmCancellation = async () => {
    const smsCode = code.trim();
    if (!token || confirming || smsCode.length === 0) return;
    setConfirming(true);
    try {
      const coolEndTime = await clientAuthApi.cancelAccount(token, smsCode);
      setSheetVisible(false);
      // 截止时间以服务端返回为准（token 已吊销无法再查）；仅在缺失时才本地兜底估算
      const serverEndTime = parseCoolEndTime(coolEndTime);
      const record = serverEndTime != null
        ? {
            phone: user?.phone ?? "",
            coolEndTime: serverEndTime,
            coolingDays,
          }
        : buildCoolingRecord(user?.phone ?? "", Date.now(), coolingDays);
      await saveCoolingRecord(record);
      // 注销等于强制登出,顺序对齐 PC forceLogout:先解绑实时资源,再清凭证。
      const { activeRoom, joiningRoom, clearActiveRoom } =
        useVoiceRoomSessionStore.getState();
      clearActiveRoom();
      if (activeRoom || joiningRoom) {
        await leaveVoiceRtc().catch(() => undefined);
        const chatroomIds = new Set([
          activeRoom?.rongChatroomId,
          joiningRoom?.rongChatroomId,
        ]);
        await Promise.allSettled(
          [...chatroomIds]
            .filter((id): id is string => Boolean(id))
            .map((id) => leaveVoiceChatRoom(id)),
        );
      }
      await messageStore.getState().reset().catch(() => undefined);
      await clearAuthSession().catch(() => undefined);
      clearSession();
      showToast(
        `已进入${coolingDays}天冷静期，账号将于 ${formatCoolEndTime(record.coolEndTime)} 完成注销`,
        { duration: toastDurations.LONG },
      );
      router.replace("/");
    } catch (error) {
      setVerifyError(
        error instanceof Error && error.message ? error.message : "验证码错误",
      );
    } finally {
      setConfirming(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          { height: 44 + insets.top, paddingTop: insets.top },
        ]}
      >
        <Pressable
          accessibilityLabel="返回"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Image source={backIcon} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>注销</Text>
        <View style={styles.headerEnd} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.paragraph}>
          账号注销成功后是不可撤销、不可逆转的。注销账户之后，您的账户及其所有内容均无法予以恢复，我们将停止为您提供产品或服务，并根据您的要求删除您的个人信息。
        </Text>
        <Text style={styles.paragraph}>
          账号注销的处理期限为{coolingDays}日，即在您已成功向我们提交了账号注销申请后的{coolingDays}日内（从成功提交申请之时起算），账号将被注销（本协议另有约定的除外）。
        </Text>
        <Text style={[styles.paragraph, styles.paragraphStrong]}>
          为确保注销的顺利完成，请您在注销申请成果提交后，不要使用该账号登录和使用相关服务和产品。若您在申请账号注销后{coolingDays}日内重新登录并使用账号的，视为放弃注销账号，该账号将恢复正常使用，本次注销申请自动失效。
        </Text>
      </ScrollView>
      <View style={[styles.bottomBar, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          onPress={() => setAgreed((value) => !value)}
          style={styles.agreementRow}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={styles.agreementText}>
            我已阅读并同意
            <Text
              style={styles.agreementLink}
              onPress={() => void openExternalLink(APP_LINKS.userAgreement)}
            >
              《注销协议》
            </Text>
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="立即注销"
          disabled={!agreed || applying}
          onPress={() => void applyCancellation()}
          style={[
            styles.submitButton,
            (!agreed || applying) && styles.submitDisabled,
          ]}
        >
          {applying ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitText}>立即注销</Text>
          )}
        </Pressable>
      </View>
      <BottomSheet
        keyboardAvoiding
        scrollable
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        contentStyle={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}
      >
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>身份验证</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭"
            onPress={() => setSheetVisible(false)}
            style={styles.sheetClose}
          >
            <Image source={closeIcon} style={styles.sheetCloseIcon} />
          </Pressable>
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>手机号</Text>
          <Text style={styles.fieldValue}>{maskedPhone}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.codeGroup}>
          <Text style={styles.codeGroupLabel}>验证码</Text>
          <View style={styles.codeRow}>
            <TextInput
              accessibilityLabel="验证码"
              value={code}
              onChangeText={(value) => {
                setCode(value);
                setVerifyError(null);
              }}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="请输入验证码"
              placeholderTextColor="#CCCCCC"
              style={styles.codeInput}
            />
            <View style={styles.codeSeparator} />
            <Pressable
              accessibilityRole="button"
              disabled={sendingCode || countdown > 0}
              onPress={() => void sendCode()}
              style={styles.sendCodeButton}
            >
              <Text
                style={[
                  styles.sendCodeText,
                  countdown > 0 && styles.sendCodeCounting,
                ]}
              >
                {sendingCode
                  ? "发送中"
                  : countdown > 0
                    ? `${countdown}s`
                    : "获取验证码"}
              </Text>
            </Pressable>
          </View>
          {verifyError ? (
            <>
              <View style={[styles.divider, styles.dividerError]} />
              <Text style={styles.errorText}>{verifyError}</Text>
            </>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="确认注销"
          disabled={!code.trim() || confirming}
          onPress={() => void confirmCancellation()}
          style={[
            styles.confirmButton,
            (!code.trim() || confirming) && styles.confirmDisabled,
          ]}
        >
          {confirming ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitText}>确认注销</Text>
          )}
        </Pressable>
      </BottomSheet>
      <AppPrompt
        visible={blockedMessage !== null}
        title="您的账户由于以下原因,暂时无法注销"
        message={blockedMessage ?? ""}
        confirmText="确定"
        onConfirm={() => setBlockedMessage(null)}
      />
    </View>
  );
}

function maskPhone(phone?: string) {
  if (!phone) return "--";
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
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
  headerTitle: {
    color: "#0A0A0A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  paragraph: {
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 24,
    fontWeight: "300",
  },
  paragraphStrong: { fontWeight: "500" },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  agreementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  checkboxMark: { color: "#FFF", fontSize: 11, lineHeight: 13, fontWeight: "700" },
  agreementText: { color: "#808080", fontSize: 12, lineHeight: 18 },
  agreementLink: { color: "#3DA5FF" },
  submitButton: {
    height: 42,
    marginTop: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  submitDisabled: { backgroundColor: "#FF99A0" },
  submitText: { color: "#FFF", fontSize: 14, lineHeight: 22, fontWeight: "500" },
  sheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 8,
  },
  sheetTitle: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    padding: 16,
  },
  sheetClose: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  sheetCloseIcon: { width: 24, height: 24, tintColor: "#0A0A0A" },
  fieldRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
  },
  fieldLabel: {
    width: 108,
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  fieldValue: {
    flex: 1,
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
  },
  codeGroup: { paddingBottom: 4 },
  codeGroupLabel: {
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  codeInput: {
    flex: 1,
    paddingVertical: 16,
    textAlign: "right",
    color: "#0A0A0A",
    fontSize: 14,
  },
  codeSeparator: {
    width: 1,
    height: 16,
    backgroundColor: "#E0E0E0",
    marginLeft: 12,
  },
  sendCodeButton: { marginLeft: 12 },
  sendCodeText: { color: "#0A0A0A", fontSize: 14, lineHeight: 22 },
  sendCodeCounting: { color: "#CCCCCC" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EBEBEB",
    marginHorizontal: 16,
  },
  dividerError: { backgroundColor: "#FF4754" },
  errorText: {
    color: "#FF4754",
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  confirmButton: {
    height: 42,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  confirmDisabled: { backgroundColor: "#FF708D" },
});
