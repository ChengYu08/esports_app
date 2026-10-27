import { useAuthStore } from "@esports/auth";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  canSubmitRealName,
  normalizeIdCard,
  realNameFailureMessage,
} from "@/features/mine/real-name";
import { useCustomerServiceEntry } from "@/features/mine/hooks/use-customer-service-entry";
import { submitRealNameVerification } from "@/features/mine/real-name-session";
import { colors } from "@/shared/theme/tokens";

const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");
const warningIcon = require("../../../../assets/mine/figma/real-name-warning.svg");
const checkIcon = require("../../../../assets/mine/figma/real-name-check.svg");
const errorIcon = require("../../../../assets/mine/figma/real-name-error.svg");
const csArrowIcon = require("../../../../assets/mine/figma/real-name-arrow-right.svg");

type Phase = "form" | "success" | "failure";

export function RealNameVerificationScreen() {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const [phase, setPhase] = useState<Phase>(
    user?.isRealName === 1 ? "success" : "form",
  );
  const [name, setName] = useState("");
  const [idCard, setIdCard] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failureMessage, setFailureMessage] = useState("");
  const {
    entering: enteringCustomerService,
    openCustomerService,
  } = useCustomerServiceEntry();

  const canSubmit = canSubmitRealName(name, idCard) && !submitting;

  const goBack = () => {
    router.back();
  };

  const refill = () => {
    setFailureMessage("");
    setPhase("form");
  };

  const submit = async () => {
    if (!token || submitting || !canSubmitRealName(name, idCard)) {
      return;
    }
    setSubmitting(true);
    try {
      await submitRealNameVerification({
        token,
        name: name.trim(),
        idCard: normalizeIdCard(idCard),
        phone: user?.phone,
      });
      setPhase("success");
    } catch (error) {
      setFailureMessage(realNameFailureMessage(error));
      setPhase("failure");
    } finally {
      setSubmitting(false);
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
          accessibilityRole="button"
          accessibilityLabel="返回"
          onPress={goBack}
          style={styles.backButton}
        >
          <Image source={backIcon} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.title}>实名认证</Text>
        <View style={styles.headerEnd} />
      </View>
      {phase === "form" ? (
        <View style={styles.formBody}>
          <View style={styles.noticeBar}>
            <Image source={warningIcon} style={styles.noticeIcon} />
            <Text style={styles.noticeText}>
              温馨提示：根据国家规定，本平台禁止未成年人交易
            </Text>
          </View>
          <View style={styles.formCard}>
            <View style={styles.fieldRow}>
              <View style={styles.fieldTitleWrap}>
                <Text style={styles.requiredMark}>*</Text>
                <Text style={styles.fieldTitle}>姓名</Text>
              </View>
              <TextInput
                accessibilityLabel="姓名"
                value={name}
                onChangeText={setName}
                placeholder="请输入真实姓名"
                placeholderTextColor="#CCCCCC"
                style={styles.input}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.fieldRow}>
              <View style={styles.fieldTitleWrap}>
                <Text style={styles.requiredMark}>*</Text>
                <Text style={styles.fieldTitle}>身份证号</Text>
              </View>
              <TextInput
                accessibilityLabel="身份证号"
                value={idCard}
                onChangeText={(value) => setIdCard(value.toUpperCase())}
                placeholder="请输入身份证号"
                placeholderTextColor="#CCCCCC"
                style={styles.input}
                maxLength={18}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
          </View>
          <View style={styles.hintCard}>
            <View style={styles.hintItem}>
              <View style={styles.hintDot} />
              <Text style={styles.hintText}>
                实名信息仅用于身份验证，平台将严格保护您的信息安全
              </Text>
            </View>
            <View style={styles.hintItem}>
              <View style={styles.hintDot} />
              <Text style={styles.hintText}>
                实名认证后不可更改，实名涉及后续
                <Text style={styles.hintHighlight}>人脸</Text>、
                <Text style={styles.hintHighlight}>包赔</Text>、
                <Text style={styles.hintHighlight}>交易收款账户</Text>
                等身份验证。
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="提交"
            disabled={!canSubmit}
            onPress={submit}
            style={[
              styles.submitButton,
              !canSubmit && styles.submitDisabled,
              { marginBottom: insets.bottom + 16 },
            ]}
          >
            <Text style={styles.submitText}>
              {submitting ? "提交中" : "提交"}
            </Text>
          </Pressable>
        </View>
      ) : phase === "success" ? (
        <View style={styles.successBody}>
          <Image source={checkIcon} style={styles.resultIcon} />
          <Text style={styles.resultTitle}>已完成实名认证</Text>
        </View>
      ) : (
        <View style={styles.failureBody}>
          <Image source={errorIcon} style={styles.resultIcon} />
          <View style={styles.failureTextWrap}>
            <Text style={styles.resultTitle}>认证失败</Text>
            <Text style={styles.failureReason}>{failureMessage}</Text>
          </View>
          <View style={styles.failureActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="返回"
              onPress={goBack}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>返回</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="重新填写"
              onPress={refill}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>重新填写</Text>
            </Pressable>
          </View>
          <View style={styles.customerServiceWrap}>
            <Text style={styles.customerServicePrefix}>如有问题，请</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="联系客服"
              disabled={enteringCustomerService}
              onPress={openCustomerService}
              style={styles.customerServiceLink}
            >
              <Text style={styles.customerServiceText}>联系客服</Text>
              <Image
                source={csArrowIcon}
                style={[styles.customerServiceArrow, { tintColor: "#3DA5FF" }]}
              />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
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
  title: {
    color: "#0A0A0A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  formBody: { flex: 1 },
  noticeBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#FFF4EB",
  },
  noticeIcon: { width: 16, height: 16 },
  noticeText: {
    flex: 1,
    color: "#F5821D",
    fontSize: 12,
    lineHeight: 18,
  },
  formCard: { backgroundColor: "#FFF" },
  fieldRow: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
  },
  fieldTitleWrap: {
    width: 108,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  requiredMark: {
    color: colors.brand,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  fieldTitle: {
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    textAlign: "right",
    color: "#0A0A0A",
    fontSize: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EBEBEB",
    marginHorizontal: 16,
  },
  hintCard: {
    marginTop: 16,
    marginHorizontal: 16,
    padding: 12,
    gap: 8,
    borderWidth: 0.5,
    borderColor: "#C2E2FF",
    borderRadius: 6,
    backgroundColor: "#F5FAFF",
  },
  hintItem: { flexDirection: "row", gap: 4 },
  hintDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 7,
    backgroundColor: "#C2E2FF",
  },
  hintText: {
    flex: 1,
    color: "#0A0A0A",
    fontSize: 12,
    lineHeight: 18,
  },
  hintHighlight: { color: "#3DA5FF" },
  submitButton: {
    height: 44,
    marginHorizontal: 16,
    marginTop: "auto",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  submitDisabled: { backgroundColor: "#FF708D" },
  submitText: { color: "#FFF", fontSize: 15, fontWeight: "500" },
  successBody: {
    flex: 1,
    alignItems: "center",
    gap: 16,
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  failureBody: {
    flex: 1,
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  resultIcon: { width: 48, height: 48 },
  resultTitle: {
    color: "#0A0A0A",
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "500",
    textAlign: "center",
  },
  failureTextWrap: { alignSelf: "stretch", gap: 8, marginTop: 16 },
  failureReason: {
    color: "#999999",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  failureActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 48,
  },
  secondaryButton: {
    width: 120,
    height: 36,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  secondaryButtonText: {
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  primaryButton: {
    width: 120,
    height: 36,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  primaryButtonText: {
    color: "#FFF",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  customerServiceWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: "auto",
    marginBottom: 72,
  },
  customerServicePrefix: {
    color: "#666666",
    fontSize: 12,
    lineHeight: 18,
  },
  customerServiceLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  customerServiceText: { color: "#3DA5FF", fontSize: 12, lineHeight: 18 },
  customerServiceArrow: { width: 16, height: 16 },
});
