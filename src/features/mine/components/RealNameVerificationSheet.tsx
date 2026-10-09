import { useAuthStore } from "@esports/auth";
import Toast from "react-native-root-toast";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { clientAuthApi } from "@/features/auth/client-auth.api";
import { toAuthUser } from "@/features/auth/client-auth-flow";
import { saveAuthSession } from "@/features/auth/session-persistence";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { AppPrompt } from "@/shared/ui/AppPrompt";

export function RealNameVerificationSheet({
  visible,
  onClose,
  onVerified,
}: {
  visible: boolean;
  onClose: () => void;
  onVerified?: () => void;
}) {
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const [name, setName] = useState("");
  const [idCard, setIdCard] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationPromptVisible, setValidationPromptVisible] = useState(false);

  const close = () => {
    if (submitting) return;
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
      setName("");
      setIdCard("");
      onClose();
      onVerified?.();
      Toast.show("认证成功", { duration: Toast.durations.SHORT });
    } catch (error) {
      Alert.alert(
        "认证失败",
        error instanceof Error ? error.message : "请稍后重试",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.backdrop}
      >
        <View style={styles.card}>
          <Text style={styles.title}>实名认证</Text>
          <Text style={styles.notice}>
            根据国家规定，本平台禁止未成年人交易
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="请输入真实姓名"
            style={styles.input}
          />
          <TextInput
            value={idCard}
            onChangeText={setIdCard}
            placeholder="请输入身份证号"
            maxLength={18}
            autoCapitalize="characters"
            style={styles.input}
          />
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
      </KeyboardAvoidingView>
      </Modal>
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
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  card: {
    gap: 14,
    padding: 20,
    paddingBottom: 28,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  title: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 18,
    fontWeight: "600",
  },
  notice: {
    color: "#666",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    lineHeight: 20,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: "#E7E7E7",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
  },
  actions: { flexDirection: "row", gap: 12, marginTop: 4 },
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
