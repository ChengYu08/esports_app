import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { sanitizePhone } from "./password-validation";
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
}: LoginScreenProps) {
  const [mode, setMode] = useState<"sms" | "password">(
    initialMode ?? "sms",
  );
  const [phone, setPhone] = useState(() => sanitizePhone(initialPhone ?? ""));
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPasswordMode = mode === "password";

  return (
    <View style={styles.screen}>
      <View style={styles.canvas}>
        <View style={styles.top}>
          <Image source={topArt} style={styles.topArt} contentFit="fill" />
          <Pressable
            accessibilityLabel="返回"
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
                onChangeText={(value) => setPhone(sanitizePhone(value))}
                autoCapitalize="none"
                keyboardType="phone-pad"
                maxLength={11}
                placeholder="请输入手机号"
                placeholderTextColor="#ccc"
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <TextInput
                value={isPasswordMode ? password : code}
                onChangeText={isPasswordMode ? setPassword : setCode}
                keyboardType={isPasswordMode ? "default" : "number-pad"}
                maxLength={isPasswordMode ? 16 : 6}
                placeholder={isPasswordMode ? "请输入密码" : "请输入验证码"}
                placeholderTextColor="#ccc"
                secureTextEntry={isPasswordMode && !passwordVisible}
                style={styles.input}
              />
              {isPasswordMode ? (
                <View style={styles.passwordActions}>
                  <Pressable
                    accessibilityLabel={passwordVisible ? "隐藏密码" : "显示密码"}
                    accessibilityRole="button"
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
                    onPress={() => void onSendCode?.(phone)}
                  >
                    <Text style={styles.send}>获取验证码</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable
              style={styles.submit}
              onPress={() =>
                void (isPasswordMode
                  ? onPasswordLogin?.({ username: phone, password })
                  : onLogin?.({ phone, code }))
              }
            >
              <Text style={styles.submitText}>
                {isPasswordMode ? "登录" : "登录/注册"}
              </Text>
            </Pressable>
            <Pressable onPress={onSkip}>
              <Text style={styles.browse}>暂不登录，先去逛逛</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.other}>
          <LoginMethod
            icon={phoneIcon}
            label="一键登录"
            onPress={onQuickLogin}
          />
          <LoginMethod
            icon={lockIcon}
            label={isPasswordMode ? "验证码登录" : "密码登录"}
            onPress={() =>
              setMode((current) => current === "sms" ? "password" : "sms")
            }
          />
          {/* <LoginMethod icon={wechatIcon} label="微信" /> */}
        </View>
        <Text style={styles.agreementText}>
          ◯ 已阅读并同意 <Text style={styles.link}>《用户协议》</Text>{" "}
          <Text style={styles.link}>《隐私政策》</Text>，未注册用户
          在登录成功后自动创建账号
        </Text>
        <View style={styles.homeIndicator} />
      </View>
    </View>
  );
}

function LoginMethod({
  icon,
  label,
  onPress,
}: {
  icon: number;
  label: string;
  onPress?: () => void | Promise<void>;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
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
  agreementText: {
    position: "absolute",
    left: 32,
    right: 32,
    top: 722,
    color: "#999",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 20,
  },
  link: { color: "#4b8bd8" },
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
