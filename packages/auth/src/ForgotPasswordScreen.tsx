import { Image } from "expo-image";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ForgotPasswordPayload } from "./sso-adapter";
import {
  sanitizeCode,
  sanitizePhone,
  validateForgotPasswordForm,
  validatePhone,
} from "./password-validation";
import { DOUYIN_SANS } from "./typography";

const backIcon = require("../assets/back.svg");
const eyeOpenIcon = require("../assets/eye-open.svg");
const eyeClosedIcon = require("../assets/eye-closed.svg");

export type ForgotPasswordScreenProps = {
  initialPhone?: string;
  onBack: () => void;
  onSendCode: (phone: string) => void | Promise<void>;
  onSubmit: (payload: ForgotPasswordPayload) => void | Promise<void>;
};

export function ForgotPasswordScreen({
  initialPhone,
  onBack,
  onSendCode,
  onSubmit,
}: ForgotPasswordScreenProps) {
  const [phone, setPhone] = useState(() => sanitizePhone(initialPhone ?? ""));
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (sending || countdown > 0) return;
    const phoneError = validatePhone(phone);
    if (phoneError) {
      setValidationMessage(phoneError);
      return;
    }

    setSending(true);
    setValidationMessage(null);
    try {
      await onSendCode(phone);
      setCountdown(60);
    } catch {
      // The route layer owns API error presentation.
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const validationError = validateForgotPasswordForm({
      phone,
      code,
      password,
      confirmation,
    });
    if (validationError) {
      setValidationMessage(validationError);
      return;
    }

    setSubmitting(true);
    setValidationMessage(null);
    try {
      await onSubmit({ phone, code, password });
    } catch {
      // The route layer owns API error presentation.
    } finally {
      setSubmitting(false);
    }
  };

  const sendLabel = sending
    ? "发送中..."
    : countdown > 0
      ? `重新获取(${countdown}s)`
      : "获取验证码";

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoiding}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="返回"
              accessibilityRole="button"
              hitSlop={10}
              onPress={onBack}
              style={styles.backButton}
            >
              <Image
                source={backIcon}
                style={styles.backIcon}
                contentFit="contain"
              />
            </Pressable>
            <Text accessibilityRole="header" style={styles.title}>
              忘记密码
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.prefix}>+86</Text>
              <TextInput
                accessibilityLabel="手机号"
                value={phone}
                onChangeText={(value) => {
                  setPhone(sanitizePhone(value));
                  setValidationMessage(null);
                }}
                keyboardType="phone-pad"
                maxLength={11}
                placeholder="请输入手机号"
                placeholderTextColor="#ccc"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <TextInput
                accessibilityLabel="验证码"
                value={code}
                onChangeText={(value) => {
                  setCode(sanitizeCode(value));
                  setValidationMessage(null);
                }}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="请输入验证码"
                placeholderTextColor="#ccc"
                style={styles.input}
              />
              <View style={styles.divider} />
              <Pressable
                accessibilityLabel={sendLabel}
                accessibilityRole="button"
                accessibilityState={{ disabled: sending || countdown > 0 }}
                disabled={sending || countdown > 0}
                onPress={() => void handleSendCode()}
              >
                <Text style={[styles.sendCode, countdown > 0 && styles.muted]}>
                  {sendLabel}
                </Text>
              </Pressable>
            </View>

            <View style={styles.field}>
              <TextInput
                accessibilityLabel="新密码"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setValidationMessage(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={16}
                placeholder="请输入新密码"
                placeholderTextColor="#ccc"
                secureTextEntry={!passwordVisible}
                style={styles.input}
              />
              <Pressable
                accessibilityLabel={passwordVisible ? "隐藏新密码" : "显示新密码"}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setPasswordVisible((visible) => !visible)}
              >
                <Image
                  accessible={false}
                  source={passwordVisible ? eyeOpenIcon : eyeClosedIcon}
                  style={styles.eyeIcon}
                  contentFit="contain"
                />
              </Pressable>
            </View>

            <View style={styles.field}>
              <TextInput
                accessibilityLabel="确认新密码"
                value={confirmation}
                onChangeText={(value) => {
                  setConfirmation(value);
                  setValidationMessage(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={16}
                placeholder="请再次输入新密码"
                placeholderTextColor="#ccc"
                secureTextEntry={!confirmationVisible}
                style={styles.input}
              />
              <Pressable
                accessibilityLabel={
                  confirmationVisible ? "隐藏确认密码" : "显示确认密码"
                }
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setConfirmationVisible((visible) => !visible)}
              >
                <Image
                  accessible={false}
                  source={confirmationVisible ? eyeOpenIcon : eyeClosedIcon}
                  style={styles.eyeIcon}
                  contentFit="contain"
                />
              </Pressable>
            </View>

            <Text style={styles.passwordHint}>
              密码长度为8-16位，需包含特殊字符（如：%、&、#等）、大写字母、小写字母、数字中的三种或以上，不允许有空格。
            </Text>

            {validationMessage ? (
              <Text
                accessibilityLiveRegion="polite"
                style={styles.validationMessage}
              >
                {validationMessage}
              </Text>
            ) : null}

            <Pressable
              accessibilityLabel="保存新密码"
              accessibilityRole="button"
              accessibilityState={{ disabled: submitting }}
              disabled={submitting}
              onPress={() => void handleSubmit()}
              style={[styles.submit, submitting && styles.submitDisabled]}
            >
              <Text style={styles.submitText}>
                {submitting ? "保存中..." : "保存"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  keyboardAvoiding: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: { width: 40, height: 40, justifyContent: "center" },
  backIcon: { width: 24, height: 24 },
  title: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 18,
    fontWeight: "600",
  },
  headerSpacer: { width: 40 },
  form: { paddingTop: 44, gap: 12 },
  field: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f7f7f7",
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
    height: 46,
    padding: 0,
    color: "#333",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
  },
  divider: { width: 1, height: 16, backgroundColor: "#ddd" },
  sendCode: { color: "#e01b28", fontFamily: DOUYIN_SANS, fontSize: 14 },
  muted: { color: "#999" },
  eyeIcon: { width: 22, height: 22 },
  passwordHint: {
    color: "#999",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  validationMessage: {
    color: "#e01b28",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  submit: {
    height: 44,
    marginTop: 24,
    borderRadius: 8,
    backgroundColor: "#e01b28",
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: { opacity: 0.55 },
  submitText: {
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
  },
});
