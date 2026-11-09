import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { useEffect, useRef, useState } from "react";
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
import {
  sanitizeCode,
  sanitizePassword,
  sanitizePhone,
  validateForgotPasswordForm,
  validatePhone,
} from "./password-validation";
import type { ForgotPasswordPayload } from "./sso-adapter";
import { PasswordVisibilityIcon } from "./PasswordVisibilityIcon";

export type ForgotPasswordScreenProps = {
  initialPhone?: string;
  /** 页面标题：忘记密码 / 修改密码等场景复用同一表单 */
  title?: string;
  onBack: () => void;
  onSendCode: (phone: string) => void | Promise<void>;
  onSubmit: (payload: ForgotPasswordPayload) => void | Promise<void>;
};

export function ForgotPasswordScreen({
  initialPhone,
  title = "忘记密码",
  onBack,
  onSendCode,
  onSubmit,
}: ForgotPasswordScreenProps) {
  const [phone, setPhone] = useState(() => {
    const normalizedPhone = sanitizePhone(initialPhone ?? "");
    return validatePhone(normalizedPhone) ? "" : normalizedPhone;
  });
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const codeInputRef = useRef<TextInput>(null);

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
      codeInputRef.current?.focus();
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

  // 设计稿：表单未填完整时保存按钮呈禁用态（粉红 #FF708D）
  const formIncomplete =
    phone.length === 0 ||
    code.length === 0 ||
    password.length === 0 ||
    confirmation.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoiding}
      >
        <ScrollView
          style={styles.scroll}
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
              <ChevronLeft24Regular color="#0A0A0A" width={24} height={24} />
            </Pressable>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.prefix}>+86</Text>
              <View style={styles.divider} />
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
                selectionColor="#FE1F4C"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <TextInput
                ref={codeInputRef}
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
                selectionColor="#FE1F4C"
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
                <Text
                  style={[
                    styles.sendCode,
                    countdown > 0 && styles.sendCodeActive,
                  ]}
                >
                  {sendLabel}
                </Text>
              </Pressable>
            </View>

            <View style={styles.field}>
              <TextInput
                accessibilityLabel="新密码"
                value={password}
                onChangeText={(value) => {
                  setPassword(sanitizePassword(value));
                  setValidationMessage(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={16}
                placeholder="请输入新密码"
                placeholderTextColor="#ccc"
                selectionColor="#FE1F4C"
                secureTextEntry={!passwordVisible}
                style={styles.input}
              />
              <Pressable
                accessibilityLabel={
                  passwordVisible ? "隐藏新密码" : "显示新密码"
                }
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setPasswordVisible((visible) => !visible)}
              >
                <PasswordVisibilityIcon visible={passwordVisible} size={22} />
              </Pressable>
            </View>

            <View style={styles.field}>
              <TextInput
                accessibilityLabel="确认新密码"
                value={confirmation}
                onChangeText={(value) => {
                  setConfirmation(sanitizePassword(value));
                  setValidationMessage(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={16}
                placeholder="请再次输入新密码"
                placeholderTextColor="#ccc"
                selectionColor="#FE1F4C"
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
                <PasswordVisibilityIcon visible={confirmationVisible} size={22} />
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
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityLabel="保存新密码"
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting || formIncomplete }}
            disabled={submitting || formIncomplete}
            onPress={() => void handleSubmit()}
            style={[styles.submit, (submitting || formIncomplete) && styles.submitDisabled]}
          >
            <Text style={styles.submitText}>
              {submitting ? "保存中..." : "保存"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  keyboardAvoiding: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 16 },
  header: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: { width: 32, height: 44, justifyContent: "center" },
  title: {
    color: "#0A0A0A",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
  },
  headerSpacer: { width: 32 },
  form: { paddingTop: 12, gap: 16 },
  field: {
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#f7f7f7",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  prefix: {
    color: "#0A0A0A",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
  input: {
    flex: 1,
    minHeight: 22,
    padding: 0,
    color: "#0A0A0A",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
    textAlignVertical: "center",
  },
  divider: { width: 1, height: 16, backgroundColor: "#E0E0E0" },
  sendCode: {
    color: "#0A0A0A",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 22,
  },
  sendCodeActive: { color: "#FE1F4C" },
  passwordHint: {
    color: "#999",
    fontSize: 12,
    lineHeight: 18,
  },
  validationMessage: {
    color: "#FE1F4C",
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  submit: {
    height: 42,
    borderRadius: 8,
    backgroundColor: "#FE1F4C",
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: { backgroundColor: "#FF708D" },
  submitText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
  },
});
