import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  canSendSmsCode,
  getSmsCodeActionLabel,
  isLoginFormReady,
  sanitizeCode,
  sanitizePhone,
} from "./password-validation";
import { DOUYIN_SANS } from "./typography";

const topArt = require("../assets/top-login.svg");
const backIcon = require("../assets/back.svg");
const phoneIcon = require("../assets/phone.svg");
const lockIcon = require("../assets/lock.svg");
const wechatIcon = require("../assets/wechat.svg");
const eyeOpenIcon = require("../assets/eye-open.svg");
const eyeClosedIcon = require("../assets/eye-closed.svg");

export type LoginPayload = { phone: string; code: string };
export type PasswordLoginPayload = { username: string; password: string };

export type LoginScreenProps = {
  initialMode?: "sms" | "password";
  initialPhone?: string;
  onBack: () => void;
  onSkip: () => void;
  onLogin?: (payload: LoginPayload) => void | Promise<void>;
  onPasswordLogin?: (payload: PasswordLoginPayload) => void | Promise<void>;
  onSendCode?: (phone: string) => void | Promise<void>;
  onQuickLogin?: () => void | Promise<void>;
  onForgotPassword?: (phone: string) => void;
  onUserAgreementPress?: () => void;
  onPrivacyPolicyPress?: () => void;
};

export function LoginScreen({
  initialMode,
  initialPhone,
  onBack,
  onSkip,
  onLogin,
  onPasswordLogin,
  onSendCode,
  onQuickLogin,
  onForgotPassword,
  onUserAgreementPress,
  onPrivacyPolicyPress,
}: LoginScreenProps) {
  const [mode, setMode] = useState<"sms" | "password">(initialMode ?? "sms");
  const [phone, setPhone] = useState(() => sanitizePhone(initialPhone ?? ""));
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [agreementModalVisible, setAgreementModalVisible] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [codeSentPhone, setCodeSentPhone] = useState("");
  const isPasswordMode = mode === "password";
  const credential = isPasswordMode ? password : code;
  const isSubmitReady = isLoginFormReady(mode, phone, credential);
  const canSendCode = canSendSmsCode(phone, isSendingCode, codeCountdown);

  useEffect(() => {
    if (codeCountdown <= 0) return;
    const timer = setTimeout(
      () => setCodeCountdown((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [codeCountdown]);

  const handlePhoneChange = (value: string) => {
    const nextPhone = sanitizePhone(value);
    setPhone(nextPhone);
    if (codeSentPhone && nextPhone !== codeSentPhone) {
      setCodeCountdown(0);
      setCodeSentPhone("");
    }
  };

  const performLogin = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (isPasswordMode) {
        await onPasswordLogin?.({ username: phone, password });
        return;
      }
      await onLogin?.({ phone, code });
    } catch {
      // The route owns login error presentation.
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!isSubmitReady || isSubmittingRef.current) return;
    if (!agreementAccepted) {
      setAgreementModalVisible(true);
      return;
    }
    void performLogin();
  };

  const handleAgreeAndContinue = () => {
    if (isSubmittingRef.current) return;
    setAgreementAccepted(true);
    setAgreementModalVisible(false);
    void performLogin();
  };

  const handleSendCode = async () => {
    if (!canSendCode || !onSendCode) return;
    setIsSendingCode(true);
    try {
      await onSendCode(phone);
      setCodeSentPhone(phone);
      setCodeCountdown(60);
    } catch {
      // The route owns API error presentation. A rejected request must not count down.
    } finally {
      setIsSendingCode(false);
    }
  };

  return (
    <View onTouchStart={Keyboard.dismiss} style={styles.screen}>
      <View style={styles.canvas}>
        <View style={styles.top}>
          <Image source={topArt} style={styles.topArt} contentFit="fill" />
          <Pressable
            accessibilityLabel="返回"
            disabled={isSubmitting}
            onPress={onBack}
            style={styles.back}
          >
            <Image
              source={backIcon}
              style={styles.backImage}
              contentFit="contain"
            />
          </Pressable>
        </View>
        <View style={styles.content}>
          <View style={styles.fields}>
            <View style={styles.field}>
              <Text style={styles.prefix}>+86</Text>
              <TextInput
                value={phone}
                onChangeText={handlePhoneChange}
                editable={!isSubmitting}
                autoCapitalize="none"
                keyboardType="phone-pad"
                maxLength={11}
                placeholder="请输入手机号"
                placeholderTextColor="#ccc"
                selectionColor="#e01b28"
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <TextInput
                value={isPasswordMode ? password : code}
                editable={!isSubmitting}
                onChangeText={
                  isPasswordMode
                    ? setPassword
                    : (value) => setCode(sanitizeCode(value))
                }
                keyboardType={isPasswordMode ? "default" : "number-pad"}
                maxLength={isPasswordMode ? 16 : 6}
                placeholder={isPasswordMode ? "请输入密码" : "请输入验证码"}
                placeholderTextColor="#ccc"
                selectionColor="#e01b28"
                secureTextEntry={isPasswordMode && !passwordVisible}
                style={styles.input}
              />
              {isPasswordMode ? (
                <View style={styles.passwordActions}>
                  <Pressable
                    accessibilityLabel={
                      passwordVisible ? "隐藏密码" : "显示密码"
                    }
                    accessibilityRole="button"
                    disabled={isSubmitting}
                    hitSlop={8}
                    onPress={() => setPasswordVisible((visible) => !visible)}
                    style={styles.eyeButton}
                  >
                    <Image
                      accessible={false}
                      source={passwordVisible ? eyeOpenIcon : eyeClosedIcon}
                      style={styles.eyeIcon}
                      contentFit="contain"
                    />
                  </Pressable>
                  <View style={styles.divider} />
                  <Pressable
                    accessibilityLabel="忘记密码"
                    accessibilityRole="button"
                    disabled={isSubmitting}
                    onPress={() => onForgotPassword?.(phone)}
                  >
                    <Text style={styles.forgotPassword}>忘记密码</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={styles.divider} />
                  <Pressable
                    accessibilityLabel="获取验证码"
                    accessibilityRole="button"
                    disabled={!canSendCode || isSubmitting}
                    onPress={() => void handleSendCode()}
                  >
                    <Text
                      style={[styles.send, !canSendCode && styles.sendDisabled]}
                    >
                      {getSmsCodeActionLabel(isSendingCode, codeCountdown)}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isSubmitting ? "登录中" : undefined}
              accessibilityState={{ disabled: !isSubmitReady || isSubmitting, busy: isSubmitting }}
              disabled={!isSubmitReady || isSubmitting}
              style={[styles.submit, isSubmitReady && styles.submitActive, isSubmitting && styles.submitLoading]}
              onPress={handleSubmit}
            >
              {isSubmitting ? (
                <View style={styles.submitContent}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.submitText}>登录中…</Text>
                </View>
              ) : (
                <Text style={styles.submitText}>
                  {isPasswordMode ? "登录" : "登录/注册"}
                </Text>
              )}
            </Pressable>
            <Pressable disabled={isSubmitting} onPress={onSkip}>
              <Text style={styles.browse}>暂不登录，先去逛逛</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.other}>
          {/* <LoginMethod
            icon={phoneIcon}
            label="一键登录"
            onPress={onQuickLogin}
          /> */}
          <LoginMethod
            icon={lockIcon}
            label={isPasswordMode ? "验证码登录" : "密码登录"}
            disabled={isSubmitting}
            onPress={() =>
              setMode((current) => (current === "sms" ? "password" : "sms"))
            }
          />
          {/* <LoginMethod icon={wechatIcon} label="微信" /> */}
        </View>
        <Pressable
          accessibilityLabel="已阅读并同意用户协议和隐私政策"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreementAccepted }}
          disabled={isSubmitting}
          hitSlop={8}
          onPress={() => setAgreementAccepted((accepted) => !accepted)}
          style={styles.agreement}
        >
          <View
            style={[
              styles.checkbox,
              agreementAccepted && styles.checkboxChecked,
            ]}
          >
            {agreementAccepted ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.agreementText}>
            已阅读并同意{" "}
            <Text accessibilityRole="link" onPress={onUserAgreementPress} style={styles.link}>《用户协议》</Text>{" "}
            <Text accessibilityRole="link" onPress={onPrivacyPolicyPress} style={styles.link}>《隐私政策》</Text>，未注册用户
            在登录成功后自动创建账号
          </Text>
        </Pressable>
        <View style={styles.homeIndicator} />
      </View>
      <Modal
        animationType="fade"
        onRequestClose={() => setAgreementModalVisible(false)}
        transparent
        visible={agreementModalVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>阅读并同意以下协议</Text>
            <Text style={styles.modalText}>
              已阅读并同意{" "}
              <Text accessibilityRole="link" onPress={onUserAgreementPress} style={styles.link}>《用户协议》</Text>{" "}
              <Text accessibilityRole="link" onPress={onPrivacyPolicyPress} style={styles.link}>《隐私政策》</Text>
              ，未注册用户在登录成功后自动创建账号
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={() => setAgreementModalVisible(false)}
                style={styles.disagreeButton}
              >
                <Text style={styles.disagreeText}>不同意</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={handleAgreeAndContinue}
                style={styles.agreeButton}
              >
                <Text style={styles.agreeText}>同意协议并继续</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function LoginMethod({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: number;
  label: string;
  onPress?: () => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      disabled={disabled}
      style={styles.method}
      onPress={() => void onPress?.()}
    >
      <View style={styles.circle}>
        <Image source={icon} style={styles.methodIcon} contentFit="contain" />
      </View>
      <Text style={styles.methodLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff", overflow: "hidden" },
  canvas: { flex: 1, width: "100%", minHeight: 812 },
  top: { height: 208, overflow: "hidden", backgroundColor: "#ffe5e7" },
  topArt: { position: "absolute", left: 0, top: 0, width: "100%", height: 208 },
  back: {
    position: "absolute",
    top: 57,
    left: 20,
    width: 20,
    height: 24,
    justifyContent: "center",
  },
  backImage: { width: 24, height: 24 },
  content: {
    position: "absolute",
    top: 196,
    left: 0,
    right: 0,
    minHeight: 616,
    paddingTop: 64,
    paddingHorizontal: 32,
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  fields: { gap: 12 },
  field: {
    height: 46,
    borderRadius: 8,
    backgroundColor: "#f7f7f7",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  prefix: {
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: "#ddd",
    color: "#333",
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    flex: 1,
    height: 22,
    padding: 0,
    color: "#333",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
  },
  divider: { width: 1, height: 16, backgroundColor: "#ddd" },
  send: { color: "#e01b28", fontFamily: DOUYIN_SANS, fontSize: 14 },
  sendDisabled: { color: "#bbb" },
  passwordActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyeButton: { width: 24, height: 24, justifyContent: "center" },
  eyeIcon: { width: 20, height: 20 },
  forgotPassword: {
    color: "#999",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
  },
  actions: { marginTop: 56, alignItems: "center" },
  submit: {
    height: 42,
    width: "100%",
    borderRadius: 8,
    backgroundColor: "#ff99a0",
    alignItems: "center",
    justifyContent: "center",
  },
  submitActive: { backgroundColor: "#e01b28" },
  submitLoading: { opacity: 0.88 },
  submitContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  submitText: {
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
  },
  browse: {
    marginTop: 16,
    color: "#999",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
  },
  other: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 614,
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
  },
  method: { width: 64, alignItems: "center" },
  circle: {
    width: 40,
    height: 40,
    marginBottom: 8,
    borderRadius: 20,
    backgroundColor: "#f7f7f7",
    alignItems: "center",
    justifyContent: "center",
  },
  methodIcon: { width: 22, height: 22 },
  methodLabel: { color: "#808080", fontFamily: DOUYIN_SANS, fontSize: 12 },
  agreement: {
    position: "absolute",
    left: 32,
    right: 32,
    top: 722,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  checkbox: {
    width: 16,
    height: 16,
    marginRight: 4,
    marginTop: 2,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { borderColor: "#e01b28", backgroundColor: "#e01b28" },
  checkmark: { color: "#fff", fontSize: 11, fontWeight: "700", lineHeight: 14 },
  agreementText: {
    flex: 1,
    color: "#999",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 20,
  },
  link: { color: "#4b8bd8" },
  modalOverlay: {
    flex: 1,
    paddingHorizontal: 32,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  modalTitle: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  modalText: {
    marginTop: 16,
    color: "#666",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
  },
  modalActions: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  disagreeButton: {
    flex: 1,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  disagreeText: { color: "#999", fontFamily: DOUYIN_SANS, fontSize: 14 },
  agreeButton: {
    flex: 2,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#e01b28",
    alignItems: "center",
    justifyContent: "center",
  },
  agreeText: {
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
  },
  homeIndicator: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    width: 133,
    height: 5,
    borderRadius: 5,
    backgroundColor: "#000",
  },
});
