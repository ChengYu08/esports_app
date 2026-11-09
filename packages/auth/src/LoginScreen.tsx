import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import {
  canSendSmsCode,
  getSmsCodeActionLabel,
  isLoginFormReady,
  sanitizeCode,
  sanitizePassword,
  sanitizePhone,
} from "./password-validation";
import { PasswordVisibilityIcon } from "./PasswordVisibilityIcon";

// iOS 端 expo-image 的 SVG 解析器（SDWebImageSVGCoder）不支持 Figma 导出的
// pattern + use + base64 image 结构，会渲染空白，改用提取出的位图资源
const topArt = require("../assets/top-login.jpg");
const phoneIcon = require("../assets/phone.svg");
const lockIcon = require("../assets/lock.svg");
const wechatIcon = require("../assets/wechat.svg");

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
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const compact = windowHeight - insets.top - insets.bottom < 700;
  const credentialInputRef = useRef<TextInput>(null);
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
    Keyboard.dismiss();
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
      credentialInputRef.current?.focus();
    } catch {
      // The route owns API error presentation. A rejected request must not count down.
    } finally {
      setIsSendingCode(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoiding}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.canvas,
            {
              paddingBottom: Math.max(insets.bottom, 24),
              paddingLeft: insets.left,
              paddingRight: insets.right,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.top, compact && styles.compactTop]}>
            <Image source={topArt} style={styles.topArt} contentFit="fill" />
            <Pressable
              accessibilityLabel="返回"
              disabled={isSubmitting}
              onPress={onBack}
              style={[styles.back, { top: insets.top + 8 }]}
            >
              <View style={styles.backImage}>
                <ChevronLeft24Regular color="#333333" width={18} height={18} />
              </View>
            </Pressable>
          </View>
          <View style={[styles.content, compact && styles.compactContent]}>
            <View style={styles.fields}>
              <View style={styles.field}>
                <Text style={styles.prefix}>+86</Text>
                <TextInput
                  accessibilityLabel="手机号"
                  value={phone}
                  onChangeText={handlePhoneChange}
                  editable={!isSubmitting}
                  autoCapitalize="none"
                  keyboardType="phone-pad"
                  maxLength={11}
                  placeholder="请输入手机号"
                  placeholderTextColor="#ccc"
                  selectionColor="#e01b28"
                  onSubmitEditing={() => credentialInputRef.current?.focus()}
                  returnKeyType="next"
                  style={styles.input}
                />
              </View>
              <View style={styles.field}>
                <TextInput
                  ref={credentialInputRef}
                  accessibilityLabel={isPasswordMode ? "密码" : "验证码"}
                  value={isPasswordMode ? password : code}
                  editable={!isSubmitting}
                  onChangeText={
                    isPasswordMode
                      ? (value) => setPassword(sanitizePassword(value))
                      : (value) => setCode(sanitizeCode(value))
                  }
                  keyboardType={isPasswordMode ? "default" : "number-pad"}
                  maxLength={isPasswordMode ? 16 : 6}
                  placeholder={isPasswordMode ? "请输入密码" : "请输入验证码"}
                  placeholderTextColor="#ccc"
                  selectionColor="#e01b28"
                  secureTextEntry={isPasswordMode && !passwordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={handleSubmit}
                  returnKeyType="done"
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
                      <PasswordVisibilityIcon
                        visible={passwordVisible}
                        size={20}
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
                        style={[
                          styles.send,
                          !canSendCode && styles.sendDisabled,
                        ]}
                      >
                        {getSmsCodeActionLabel(isSendingCode, codeCountdown)}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
            <View style={[styles.actions, compact && styles.compactActions]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isSubmitting ? "登录中" : undefined}
                accessibilityState={{
                  disabled: !isSubmitReady || isSubmitting,
                  busy: isSubmitting,
                }}
                disabled={!isSubmitReady || isSubmitting}
                style={[
                  styles.submit,
                  isSubmitReady && styles.submitActive,
                  isSubmitting && styles.submitLoading,
                ]}
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
          <View style={[styles.footer, compact && styles.compactFooter]}>
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
              style={[styles.agreement, compact && styles.compactAgreement]}
            >
              <View style={styles.checkbox}>
                {/* 透明占位字撑出与首行相同的文本行高（随系统字体缩放变化，不写死像素），
                    勾选圆点在该行内居中，任何字号/设备下都与首行垂直居中 */}
                <Text
                  accessible={false}
                  importantForAccessibility="no"
                  numberOfLines={1}
                  style={styles.checkboxSpacer}
                >
                  .
                </Text>
                <View style={styles.checkboxGraphic}>
                  {agreementAccepted ? (
                    // 勾选态按 Figma Checkbox/Small-16：16 框内 13px 实心圆 + 白色勾
                    <Svg height={16} viewBox="0 0 16 16" width={16}>
                      <Path
                        d="M14.5 8C14.5 11.5899 11.5899 14.5 8 14.5C4.41015 14.5 1.5 11.5899 1.5 8C1.5 4.41015 4.41015 1.5 8 1.5C11.5899 1.5 14.5 4.41015 14.5 8Z"
                        fill="#FE1F4C"
                      />
                      <Path
                        d="M4.58394 7.66735C4.79874 7.45266 5.14673 7.4526 5.36148 7.66735L7.16102 9.46688L10.5294 6.09846C10.7442 5.88393 11.0923 5.88376 11.307 6.09846C11.5216 6.31317 11.5215 6.66123 11.307 6.876L7.5491 10.6339C7.33434 10.8486 6.98635 10.8486 6.77155 10.6339C6.76905 10.6314 6.7671 10.6281 6.76465 10.6256L4.58394 8.44489C4.36915 8.23011 4.36915 7.88214 4.58394 7.66735Z"
                        fill="#FFFFFF"
                      />
                    </Svg>
                  ) : (
                    <View style={styles.checkboxCircle} />
                  )}
                </View>
              </View>
              <Text style={styles.agreementText}>
                已阅读并同意{" "}
                <Text
                  accessibilityRole="link"
                  onPress={onUserAgreementPress}
                  style={styles.link}
                >
                  《用户协议》
                </Text>{" "}
                <Text
                  accessibilityRole="link"
                  onPress={onPrivacyPolicyPress}
                  style={styles.link}
                >
                  《隐私政策》
                </Text>
                ，未注册用户 在登录成功后自动创建账号
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        animationType="fade"
        onRequestClose={() => setAgreementModalVisible(false)}
        transparent
        visible={agreementModalVisible}
      >
        <View
          style={[
            styles.modalOverlay,
            {
              paddingTop: insets.top + 24,
              paddingBottom: insets.bottom + 24,
              paddingLeft: insets.left + 24,
              paddingRight: insets.right + 24,
            },
          ]}
        >
          <View style={styles.modalCard}>
            <ScrollView
              style={styles.modalCopy}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>阅读并同意以下协议</Text>
              <Text style={styles.modalText}>
                已阅读并同意{" "}
                <Text
                  accessibilityRole="link"
                  onPress={onUserAgreementPress}
                  style={styles.link}
                >
                  《用户协议》
                </Text>{" "}
                <Text
                  accessibilityRole="link"
                  onPress={onPrivacyPolicyPress}
                  style={styles.link}
                >
                  《隐私政策》
                </Text>
                ，未注册用户在登录成功后自动创建账号
              </Text>
            </ScrollView>
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

// 勾选框占满首行行高并居中，保证圆点与首行文字垂直居中
const AGREEMENT_LINE_HEIGHT = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  keyboardAvoiding: { flex: 1 },
  scroll: { flex: 1 },
  canvas: { flexGrow: 1 },
  top: { height: 208, overflow: "hidden", backgroundColor: "#ffe5e7" },
  compactTop: { height: 176 },
  topArt: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
  },
  back: {
    position: "absolute",
    left: 8,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backImage: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    marginTop: -12,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingTop: 64,
    paddingHorizontal: 32,
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  fields: { gap: 12 },
  compactContent: { paddingTop: 32 },
  field: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: "#f7f7f7",
    paddingHorizontal: 12,
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
    minHeight: 46,
    padding: 0,
    color: "#333",
    fontSize: 14,
    textAlignVertical: "center",
  },
  divider: { width: 1, height: 16, backgroundColor: "#ddd" },
  send: {
    color: "#FE1F4C",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 22,
  },
  sendDisabled: { color: "#bbb" },
  passwordActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyeButton: { width: 24, height: 24, justifyContent: "center" },
  forgotPassword: {
    color: "#999",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 22,
  },
  actions: { marginTop: 56, alignItems: "center" },
  compactActions: { marginTop: 32 },
  submit: {
    height: 42,
    width: "100%",
    borderRadius: 8,
    backgroundColor: "#FF708D",
    alignItems: "center",
    justifyContent: "center",
  },
  submitActive: { backgroundColor: "#FE1F4C" },
  submitLoading: { opacity: 0.88 },
  submitContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  submitText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  browse: {
    marginTop: 16,
    color: "#999",
    fontSize: 12,
  },
  footer: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingTop: 72,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  other: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
  },
  compactFooter: { paddingTop: 32 },
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
  methodLabel: { color: "#808080", fontSize: 12 },
  agreement: {
    marginTop: 40,
    marginBottom: 22,
    marginHorizontal: 32,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  compactAgreement: { marginTop: 24 },
  checkbox: {
    width: 16,
    marginRight: 4,
  },
  // 与协议文案同名文字样式：其行盒高度就是首行实际行高，随系统字体缩放变化
  checkboxSpacer: {
    fontSize: 12,
    lineHeight: AGREEMENT_LINE_HEIGHT,
    opacity: 0,
  },
  // RN 0.86 已移除 StyleSheet.absoluteFillObject，这里显式铺满占位行盒
  checkboxGraphic: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxCircle: {
    width: 13,
    height: 13,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6.5,
  },
  agreementText: {
    flex: 1,
    color: "#999",
    fontSize: 12,
    lineHeight: AGREEMENT_LINE_HEIGHT,
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
    maxHeight: "100%",
    flexShrink: 1,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  modalCopy: { flexGrow: 0, flexShrink: 1 },
  modalTitle: {
    color: "#222",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  modalText: {
    marginTop: 16,
    color: "#666",
    fontSize: 14,
    lineHeight: 22,
  },
  modalActions: {
    flexShrink: 0,
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  disagreeButton: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    backgroundColor: "#FFF",
  },
  disagreeText: { color: "#333", fontSize: 14, fontWeight: "600" },
  agreeButton: {
    flex: 2,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#FE1F4C",
    alignItems: "center",
    justifyContent: "center",
  },
  agreeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
