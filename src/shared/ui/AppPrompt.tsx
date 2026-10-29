import { DOUYIN_SANS } from "@/shared/theme/typography";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BRAND = "#FE1F4C";

export function AppPrompt({
  visible,
  title = "提示",
  message,
  confirmText = "知道了",
  cancelText,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onCancel?: () => void;
  onConfirm: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onCancel ?? onConfirm}
    >
      <View
        style={[
          styles.backdrop,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingLeft: insets.left + 36,
            paddingRight: insets.right + 36,
          },
        ]}
      >
        <View style={styles.dialog}>
          <ScrollView
            style={styles.copy}
            contentContainerStyle={styles.copyContent}
          >
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </ScrollView>
          <View style={styles.actions}>
            {cancelText && onCancel && (
              <Pressable
                accessibilityRole="button"
                style={[styles.button, styles.cancelButton]}
                onPress={onCancel}
              >
                <Text style={styles.cancelText}>{cancelText}</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              style={[styles.button, styles.confirmButton]}
              onPress={onConfirm}
            >
              <Text style={styles.buttonText}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  dialog: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "100%",
    flexShrink: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  copy: { alignSelf: "stretch", flexGrow: 0, flexShrink: 1 },
  copyContent: {
    gap: 12,
    padding: 16,
  },
  title: {
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
    textAlign: "center",
  },
  message: {
    color: "#666666",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 22,
    textAlign: "left",
  },
  actions: {
    flexShrink: 0,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 56,
    // 设计稿 Dialog button group：高 56、按钮 36 → 上下各 10，保证按钮垂直居中
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },
  button: {
    flex: 1,
    minWidth: 86,
    height: 36,
    // 36 高由 justify center 垂直居中文字，不加垂直 padding（会挤占 22 行高导致文字下沉）
    paddingVertical: 0,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND,
  },
  confirmButton: {
    backgroundColor: BRAND,
  },
  cancelText: {
    color: BRAND,
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
    textAlign: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
    textAlign: "center",
  },
});
