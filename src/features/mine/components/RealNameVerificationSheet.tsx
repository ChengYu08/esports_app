import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import Toast from "react-native-root-toast";
import { useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "@/shared/ui/BottomSheet";

import { clientAuthApi } from "@/features/auth/client-auth.api";
import { toAuthUser } from "@/features/auth/client-auth-flow";
import { saveAuthSession } from "@/features/auth/session-persistence";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { AppPrompt } from "@/shared/ui/AppPrompt";

const nameIcon = require("../../../../assets/home/h_user.svg");
const idCardIcon = require("../../../../assets/home/h_id.svg");

export function RealNameVerificationSheet({
  visible,
  onClose,
  onVerified,
}: {
  visible: boolean;
  onClose: () => void;
  onVerified?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const [name, setName] = useState("");
  const [idCard, setIdCard] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationPromptVisible, setValidationPromptVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<"name" | "idCard" | null>(null);
  const idCardInputRef = useRef<TextInput>(null);

  const close = () => {
    if (submitting) return;
    Keyboard.dismiss();
    setFocusedField(null);
    setName("");
    setIdCard("");
    setValidationPromptVisible(false);
    onClose();
  };

  const submit = async () => {
    const normalizedName = name.trim();
    const normalizedIdCard = idCard.trim().toUpperCase();
    if (!token || !normalizedName || !isValidIdCard(normalizedIdCard)) {
      setValidationPromptVisible(true);
      return;
    }

    setSubmitting(true);
    try {
      await clientAuthApi.realNameVerify(token, {
        name: normalizedName,
        num: normalizedIdCard,
      });
      const profile = await clientAuthApi.fetchCurrentUser(token);
      const session = {
        accessToken: token,
        user: toAuthUser(profile, user?.phone),
      };
      await saveAuthSession(session);
      setSession(session);
      Keyboard.dismiss();
      setFocusedField(null);
      setName("");
      setIdCard("");
      onClose();
      onVerified?.();
      Toast.show("认证成功", { duration: Toast.durations.SHORT });
    } catch (error) {
      Toast.show(
        `认证失败，${error instanceof Error ? error.message : "请稍后重试"}`,
        { duration: Toast.durations.SHORT },
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <BottomSheet
        keyboardAvoiding
        visible={visible}
        onClose={close}
        contentStyle={styles.frame}
      >
        <View style={[styles.card, { paddingBottom: 20 + insets.bottom }]}>
          <Text style={styles.title}>实名认证</Text>
          <Text style={styles.notice}>
            根据国家规定，本平台禁止未成年人交易
          </Text>
          <Text style={styles.fieldLabel}>真实姓名</Text>
          <View
            style={[
              styles.inputShell,
              focusedField === "name" && styles.inputShellFocused,
            ]}
          >
            <View style={styles.inputIconWrap}>
              <Image source={nameIcon} style={styles.inputIcon} />
            </View>
            <TextInput
              accessibilityLabel="真实姓名"
              value={name}
              onChangeText={setName}
              onFocus={() => setFocusedField("name")}
              onBlur={() => setFocusedField(null)}
              onSubmitEditing={() => idCardInputRef.current?.focus()}
              blurOnSubmit={false}
              returnKeyType="next"
              placeholder="请输入真实姓名"
              placeholderTextColor="#B4B7BE"
              style={styles.input}
            />
          </View>
          <Text style={styles.fieldLabel}>身份证号</Text>
          <View
            style={[
              styles.inputShell,
              focusedField === "idCard" && styles.inputShellFocused,
            ]}
          >
            <View style={styles.inputIconWrap}>
              <Image source={idCardIcon} style={styles.inputIcon} />
            </View>
            <TextInput
              ref={idCardInputRef}
              accessibilityLabel="身份证号"
              value={idCard}
              onChangeText={(value) => setIdCard(value.toUpperCase())}
              onFocus={() => setFocusedField("idCard")}
              onBlur={() => setFocusedField(null)}
              onSubmitEditing={() => Keyboard.dismiss()}
              placeholder="请输入18位身份证号"
              placeholderTextColor="#B4B7BE"
              keyboardType="default"
              maxLength={18}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              style={styles.input}
            />
            <Text style={styles.inputCount}>{idCard.length}/18</Text>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={close} style={styles.cancelButton}>
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
            <Pressable
              disabled={submitting}
              onPress={() => void submit()}
              style={styles.confirmButton}
            >
              <Text style={styles.confirmText}>
                {submitting ? "提交中" : "提交认证"}
              </Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>
      <AppPrompt
        visible={validationPromptVisible}
        title="信息有误"
        message="请输入姓名和正确的18位身份证号"
        confirmText="我知道了"
        onConfirm={() => setValidationPromptVisible(false)}
      />
    </>
  );
}

function isValidIdCard(value: string) {
  if (!/^\d{17}[\dX]$/.test(value)) return false;
  const birth = `${value.slice(6, 10)}-${value.slice(10, 12)}-${value.slice(12, 14)}`;
  const [year, month, day] = birth.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return year >= 1900
    && date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    && date <= new Date();
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    justifyContent: "flex-end",
  },
  card: {
    paddingHorizontal: 20,
    paddingTop: 22,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  title: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 18,
    fontWeight: "600",
  },
  notice: {
    color: "#7C818C",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
    marginBottom: 20,
  },
  fieldLabel: {
    color: "#30343B",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  inputShell: {
    alignItems: "center",
    flexDirection: "row",
    height: 50,
    borderWidth: 1,
    borderColor: "#E6E8ED",
    borderRadius: 11,
    backgroundColor: "#F8F9FB",
    paddingHorizontal: 12,
    marginBottom: 15,
  },
  inputShellFocused: {
    borderColor: "#FF1F4C",
    backgroundColor: "#FFF7F8",
    shadowColor: "#FF1F4C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 1,
  },
  inputIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    marginRight: 10,
  },
  inputIcon: { width: 17, height: 17 },
  input: {
    flex: 1,
    height: "100%",
    paddingVertical: 0,
    color: "#17191D",
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
  },
  inputCount: {
    color: "#A1A5AE",
    fontFamily: DOUYIN_SANS,
    fontSize: 11,
    marginLeft: 8,
  },
  actions: { flexDirection: "row", gap: 12, marginTop: 5 },
  cancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F7F7",
  },
  cancelText: { color: "#666", fontFamily: DOUYIN_SANS, fontSize: 15 },
  confirmButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF1F4C",
  },
  confirmText: { color: "#FFF", fontFamily: DOUYIN_SANS, fontSize: 15 },
});
