import { DOUYIN_SANS } from "@/lib/fonts";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const topArt = require("../../assets/login/top-login.svg");
const backIcon = require("../../assets/com/back.svg");
const phoneIcon = require("../../assets/login/phone.svg");
const lockIcon = require("../../assets/login/lock.svg");
const wechatIcon = require("../../assets/login/wechat.svg");

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden />
      <View style={styles.canvas}>
        <View style={styles.top}>
          <Image source={topArt} style={styles.topArt} contentFit="fill" />
          <Pressable
            accessibilityLabel="返回"
            onPress={() => router.back()}
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
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="请输入手机号"
                placeholderTextColor="#ccc"
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <TextInput
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                placeholder="请输入验证码"
                placeholderTextColor="#ccc"
                style={styles.input}
              />
              <View style={styles.divider} />
              <Pressable accessibilityLabel="获取验证码">
                <Text style={styles.send}>获取验证码</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.submit}>
              <Text style={styles.submitText}>登录/注册</Text>
            </Pressable>
            <Pressable onPress={() => router.replace("/")}>
              <Text style={styles.browse}>暂不登录，先去逛逛</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.other}>
          <LoginMethod icon={phoneIcon} label="一键登录" />
          <LoginMethod icon={lockIcon} label="密码登录" />
          <LoginMethod icon={wechatIcon} label="微信" />
        </View>
        <Text style={styles.agreementText}>
          ◯ 已阅读并同意 <Text style={styles.link}>《用户协议》</Text>{" "}
          <Text style={styles.link}>《隐私政策》</Text>，未注册用户{"\n"}
          　　在登录成功后自动创建账号
        </Text>
        <View style={styles.homeIndicator} />
      </View>
    </View>
  );
}

function LoginMethod({ icon, label }: { icon: number; label: string }) {
  return (
    <Pressable accessibilityLabel={label} style={styles.method}>
      <View style={styles.circle}>
        <Image source={icon} style={styles.methodIcon} contentFit="contain" />
      </View>
      <Text style={styles.methodLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
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
