import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSheet } from "@/shared/ui/BottomSheet";
import type { OrderReview } from "../order.api";

type Props = {
  visible: boolean;
  readonly: boolean;
  detail?: OrderReview | null;
  onClose: () => void;
  onSubmit: (rating: number, content: string) => Promise<void>;
};

export function OrderReviewSheet({
  visible,
  readonly,
  detail,
  onClose,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // The sheet is remounted by its parent when switching between editable and read-only reviews.
  useEffect(() => {
    if (detail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRating(detail.rating);
      setContent(detail.content || "");
    } else if (visible && !readonly) {
      setRating(5);
      setContent("");
    }
  }, [detail, readonly, visible]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(rating, content.trim());
      Keyboard.dismiss();
      onClose();
    } catch (error) {
      Alert.alert(
        "评价提交失败",
        error instanceof Error ? error.message : "请稍后重试",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      contentStyle={styles.frame}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardFrame}
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{readonly ? "评价详情" : "评价"}</Text>
            <Pressable
              accessibilityLabel="关闭评价弹窗"
              accessibilityRole="button"
              disabled={submitting}
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((item) => (
              <Pressable
                key={item}
                accessibilityLabel={`${item}星`}
                accessibilityRole="button"
                accessibilityState={{ selected: item === rating, disabled: readonly }}
                disabled={readonly}
                onPress={() => setRating(item)}
              >
                <Text style={[styles.star, item <= rating && styles.starOn]}>★</Text>
              </Pressable>
            ))}
          </View>
          {readonly ? (
            <Text style={styles.readonly}>{content || "暂未填写评价内容"}</Text>
          ) : (
            <TextInput
              accessibilityLabel="评价内容"
              editable={!submitting}
              multiline
              maxLength={500}
              onChangeText={setContent}
              placeholder="请输入评价内容（选填）"
              placeholderTextColor="#999999"
              returnKeyType="default"
              scrollEnabled
              style={styles.input}
              textAlignVertical="top"
              value={content}
            />
          )}
          {!readonly && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: submitting }}
              disabled={submitting}
              onPress={() => void submit()}
              style={[styles.submit, submitting && styles.submitDisabled]}
            >
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>提交评价</Text>}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  keyboardFrame: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "700", color: "#111111" },
  closeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  close: { fontSize: 28, lineHeight: 32, color: "#777777" },
  stars: { flexDirection: "row", justifyContent: "center", gap: 10, paddingVertical: 18 },
  star: { fontSize: 32, lineHeight: 40, color: "#DDDDDD" },
  starOn: { color: "#FFB21C" },
  input: {
    minHeight: 110,
    maxHeight: 180,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    padding: 12,
    color: "#222222",
    fontSize: 14,
    lineHeight: 21,
  },
  readonly: { minHeight: 80, color: "#333333", lineHeight: 22 },
  submit: {
    marginTop: 16,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FE1F4C",
  },
  submitDisabled: { opacity: 0.65 },
  submitText: { color: "#FFFFFF", fontWeight: "600" },
});
