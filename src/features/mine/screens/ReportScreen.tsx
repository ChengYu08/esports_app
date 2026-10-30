import { ChevronLeft24Regular } from "@fluentui/react-native-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showToast } from "@/shared/ui/app-toast";
import { useAuthStore } from "@esports/auth";

import { submitReport } from "@/features/mine/api/report.api";
import { DOUYIN_SANS } from "@/shared/theme/typography";

const REPORT_REASONS = [
  "政治",
  "诈骗",
  "侵权",
  "色情",
  "侮辱诋毁",
  "广告拉人",
  "其他原因",
] as const;

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSearchParams<{ userId?: string | string[] }>();
  const [selectedReason, setSelectedReason] = useState<
    (typeof REPORT_REASONS)[number] | ""
  >("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const trimmedDescription = description.trim();
  const canSubmit = Boolean(selectedReason && trimmedDescription) && !submitting;
  const reportedUserId = typeof userId === "string" ? userId : userId?.[0] ?? "";

  async function handleSubmit() {
    if (!canSubmit) return;
    if (!reportedUserId) {
      showToast("缺少举报对象");
      return;
    }
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      showToast("请先登录");
      return;
    }
    setSubmitting(true);
    try {
      await submitReport(
        {
          reportedUserId,
          reason: selectedReason,
          description: trimmedDescription,
        },
        token,
      );
      showToast("举报成功");
      router.back();
    } catch (error) {
      setSubmitting(false);
      showToast(error instanceof Error ? error.message : "举报失败");
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <View
        style={[
          styles.header,
          { height: insets.top + 44, paddingTop: insets.top },
        ]}
      >
        <Pressable
          accessibilityLabel="返回"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ChevronLeft24Regular color="#111111" width={24} height={24} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>举报</Text>
        <View style={styles.headerEnd} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 24) + 16 },
        ]}
      >
        <Text style={styles.sectionTitle}>举报原因</Text>
        <View style={styles.reasonList}>
          {REPORT_REASONS.map((reason) => {
            const selected = selectedReason === reason;
            return (
              <Pressable
                key={reason}
                accessibilityLabel={reason}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: submitting }}
                disabled={submitting}
                onPress={() => setSelectedReason(reason)}
                style={({ pressed }) => [
                  styles.reasonRow,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.reasonText}>{reason}</Text>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.descriptionHeader}>
          <Text style={styles.sectionTitle}>请描述举报原因</Text>
          <Text style={styles.required}>必填</Text>
        </View>
        <TextInput
          accessibilityLabel="请描述举报原因"
          editable={!submitting}
          multiline
          maxLength={500}
          onChangeText={setDescription}
          placeholder="请输入举报原因"
          placeholderTextColor="#B8B8B8"
          style={styles.descriptionInput}
          textAlignVertical="top"
          value={description}
        />
        <Text style={styles.counter}>{description.length}/500</Text>

        <Pressable
          accessibilityLabel="提交举报"
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            !canSubmit && styles.submitButtonDisabled,
            pressed && canSubmit && styles.submitButtonPressed,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>提交举报</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  header: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  backButton: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  backIcon: { height: 24, width: 24 },
  headerTitle: {
    color: "#111111",
    fontFamily: DOUYIN_SANS,
    fontSize: 17,
    fontWeight: "600",
  },
  headerEnd: { height: 28, width: 28 },
  content: { paddingHorizontal: 16, paddingTop: 24 },
  sectionTitle: {
    color: "#111111",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "600",
  },
  reasonList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    marginTop: 12,
    overflow: "hidden",
  },
  reasonRow: {
    alignItems: "center",
    borderBottomColor: "#F0F0F0",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    height: 52,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  reasonText: { color: "#222222", fontFamily: DOUYIN_SANS, fontSize: 15 },
  radio: {
    alignItems: "center",
    borderColor: "#C8C8C8",
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  radioSelected: { borderColor: "#FF3158" },
  radioDot: {
    backgroundColor: "#FF3158",
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  descriptionHeader: {
    alignItems: "baseline",
    flexDirection: "row",
    marginTop: 24,
  },
  required: {
    color: "#FF3158",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    marginLeft: 6,
  },
  descriptionInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    color: "#222222",
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
    height: 132,
    lineHeight: 22,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  counter: {
    color: "#AAAAAA",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    marginTop: 6,
    textAlign: "right",
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: "#FF3158",
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    marginTop: 28,
  },
  submitButtonDisabled: { backgroundColor: "#FFB6C4" },
  submitButtonPressed: { opacity: 0.82 },
  submitText: { color: "#FFFFFF", fontFamily: DOUYIN_SANS, fontSize: 16, fontWeight: "600" },
  pressed: { opacity: 0.65 },
});
