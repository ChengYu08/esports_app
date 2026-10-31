import { Add24Regular } from "@fluentui/react-native-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { beginMediaPick } from "@/shared/media-picker/media-picker-session";
import { useAppConfirm } from "@/shared/ui/app-confirm";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import type { OrderReview } from "../order.api";

const RATING_LABELS = ["非常差", "差", "一般", "好", "非常好"];
const MAX_IMAGES = 5;
const MAX_CONTENT_LENGTH = 50;
const starIcon = require("../../../../assets/order/review-star.svg");

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
  const [images, setImages] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (detail) {
      // The sheet is remounted when switching between editable and read-only reviews.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRating(Math.min(5, Math.max(1, Number(detail.rating) || 5)));
      setContent(detail.content || "");
      setImages(detail.imageUrls?.slice(0, MAX_IMAGES) ?? []);
    } else if (visible && !readonly) {
      setRating(5);
      setContent("");
      setImages([]);
      setAnonymous(true);
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
      void useAppConfirm.getState().confirm({
        title: "评价提交失败",
        message: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const pickImages = async () => {
    if (readonly || submitting || images.length >= MAX_IMAGES) return;
    // 相册选择页内部处理权限，选图结果经会话桥接回传
    const pickPending = beginMediaPick();
    router.push({
      pathname: "/media-picker",
      params: { max: String(MAX_IMAGES - images.length) },
    });
    const picked = await pickPending;
    if (!picked?.length) return;
    setImages((current) => [...current, ...picked].slice(0, MAX_IMAGES));
  };

  return (
    <BottomSheet
      fullScreen
      visible={visible}
      onClose={onClose}
      dismissOnBackdropPress={!submitting}
      contentStyle={styles.frame}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardFrame}
      >
        <View style={styles.screen}>
          <View style={[styles.header, { paddingTop: insets.top }]}>
            <Pressable
              accessibilityLabel="关闭评价反馈"
              accessibilityRole="button"
              disabled={submitting}
              hitSlop={8}
              onPress={onClose}
              style={styles.backButton}
            >
              <Text style={styles.backIcon}>‹</Text>
            </Pressable>
            <Text accessibilityRole="header" style={styles.title}>评价反馈</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            bounces={false}
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.ratingSection}>
              <Text style={styles.sectionLabel}>
                <Text style={styles.required}>*</Text>整体评价
              </Text>
              <View style={styles.ratings}>
                {RATING_LABELS.map((label, index) => {
                  const value = index + 1;
                  const selected = value === rating;
                  return (
                    <Pressable
                      key={label}
                      accessibilityLabel={`${value}星，${label}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: readonly }}
                      disabled={readonly || submitting}
                      onPress={() => setRating(value)}
                      style={styles.ratingItem}
                    >
                      <Image
                        contentFit="contain"
                        source={starIcon}
                        style={[styles.star, value > rating && styles.starOff]}
                      />
                      <Text style={[styles.ratingLabel, selected && styles.ratingLabelOn]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.contentSection}>
              <Text style={styles.sectionLabel}>评价内容</Text>
              {readonly ? (
                <Text style={[styles.readonlyContent, !content && styles.placeholder]}>
                  {content || "暂未填写评价内容"}
                </Text>
              ) : (
                <TextInput
                  accessibilityLabel="评价内容"
                  editable={!submitting}
                  maxLength={MAX_CONTENT_LENGTH}
                  multiline
                  onChangeText={setContent}
                  placeholder="请输入个人诉求"
                  placeholderTextColor="#CCCCCC"
                  scrollEnabled
                  style={styles.input}
                  textAlignVertical="top"
                  value={content}
                />
              )}
              {!readonly && (
                <Text style={styles.counter}>
                  {content.length}/{MAX_CONTENT_LENGTH}
                </Text>
              )}
            </View>

            {(!readonly || images.length > 0) && (
              <View style={styles.imageSection}>
                <Text style={styles.sectionLabel}>图片</Text>
                <View style={styles.imageRow}>
                  {images.map((uri, index) => (
                    <View key={`${uri}-${index}`} style={styles.imageFrame}>
                      <Image contentFit="cover" source={{ uri }} style={styles.thumbnail} />
                      {!readonly && (
                        <Pressable
                          accessibilityLabel={`删除第${index + 1}张图片`}
                          accessibilityRole="button"
                          disabled={submitting}
                          onPress={() => setImages((current) => current.filter((_, i) => i !== index))}
                          style={styles.removeImage}
                        >
                          <Text style={styles.removeImageText}>×</Text>
                        </Pressable>
                      )}
                    </View>
                  ))}
                  {!readonly && images.length < MAX_IMAGES && (
                    <Pressable
                      accessibilityLabel="添加评价图片"
                      accessibilityRole="button"
                      disabled={submitting}
                      onPress={() => void pickImages()}
                      style={styles.addImage}
                    >
                      <View style={styles.addIcon}>
                        <Add24Regular color="#CCCCCC" width={24} height={24} />
                      </View>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {!readonly && (
              <View style={styles.anonymousSection}>
                <Text style={styles.sectionLabel}>
                  <Text style={styles.required}>*</Text>匿名评价
                </Text>
                <View style={styles.anonymousOptions}>
                  {[true, false].map((value) => (
                    <Pressable
                      key={String(value)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: anonymous === value }}
                      disabled={submitting}
                      onPress={() => setAnonymous(value)}
                      style={[
                        styles.anonymousOption,
                        anonymous === value && styles.anonymousOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.anonymousOptionText,
                          anonymous === value && styles.anonymousOptionTextSelected,
                        ]}
                      >
                        {value ? "隐藏个人信息" : "公开个人信息"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {!readonly && (
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: submitting }}
                disabled={submitting}
                onPress={() => void submit()}
                style={[styles.submit, submitting && styles.submitDisabled]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitText}>发布评价</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  keyboardFrame: { flex: 1 },
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  header: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  backButton: { width: 56, height: 44, justifyContent: "center", paddingLeft: 18 },
  backIcon: { color: "#0A0A0A", fontSize: 32, lineHeight: 36 },
  title: {
    flex: 1,
    color: "#0A0A0A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    textAlign: "center",
  },
  headerSpacer: { width: 56 },
  form: { gap: 8, paddingTop: 8, paddingBottom: 8 },
  sectionLabel: { color: "#0A0A0A", fontSize: 14, lineHeight: 22, fontWeight: "500" },
  required: { color: "#E01B28" },
  ratingSection: { paddingHorizontal: 16, paddingTop: 16, backgroundColor: "#FFFFFF" },
  ratings: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  ratingItem: { flex: 1, alignItems: "center", gap: 12 },
  star: { width: 32, height: 32 },
  starOff: { tintColor: "#ABABAD" },
  ratingLabel: { color: "#ABABAD", fontSize: 12, lineHeight: 18 },
  ratingLabelOn: { color: "#FF943D", fontWeight: "500" },
  contentSection: { minHeight: 130, backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingTop: 16 },
  input: {
    flex: 1,
    minHeight: 74,
    paddingHorizontal: 0,
    paddingTop: 12,
    paddingBottom: 24,
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
  },
  readonlyContent: {
    minHeight: 74,
    paddingHorizontal: 0,
    paddingTop: 12,
    paddingBottom: 24,
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
  },
  placeholder: { color: "#CCCCCC" },
  counter: {
    position: "absolute",
    right: 16,
    bottom: 4,
    color: "#CCCCCC",
    fontSize: 12,
    lineHeight: 18,
  },
  imageSection: { backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  imageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, paddingHorizontal: 0 },
  imageFrame: { width: 62, height: 62, position: "relative" },
  thumbnail: { width: 62, height: 62, borderRadius: 6, backgroundColor: "#F7F7F7" },
  removeImage: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,.6)",
  },
  removeImageText: { color: "#FFFFFF", fontSize: 18, lineHeight: 20 },
  addImage: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "#F7F7F7",
  },
  addIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  anonymousSection: { minHeight: 130, backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingTop: 16 },
  anonymousOptions: { flexDirection: "row", gap: 8, paddingHorizontal: 0, paddingTop: 16, paddingBottom: 16 },
  anonymousOption: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderRadius: 4,
    backgroundColor: "#F7F7F7",
  },
  anonymousOptionSelected: { backgroundColor: "#FFF2F5" },
  anonymousOptionText: { color: "#0A0A0A", fontSize: 12, lineHeight: 18 },
  anonymousOptionTextSelected: { color: "#FE1F4C", fontWeight: "500" },
  footer: {
    paddingTop: 8,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },
  submit: {
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#FF708D",
  },
  submitDisabled: { opacity: 0.65 },
  submitText: { color: "#FFFFFF", fontSize: 14, lineHeight: 22, fontWeight: "500" },
});
