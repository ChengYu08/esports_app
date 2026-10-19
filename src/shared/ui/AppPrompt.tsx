import { DOUYIN_SANS } from "@/shared/theme/typography";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
              style={[
                styles.button,
                cancelText ? styles.confirmButton : styles.singleButton,
              ]}
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
    borderRadius: 20,
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  copy: { alignSelf: "stretch", flexGrow: 0, flexShrink: 1 },
  copyContent: { alignItems: "center" },
  iconText: { color: "#FF3158", fontSize: 28, fontWeight: "700" },
  title: {
    marginTop: 14,
    color: "#111",
    fontFamily: DOUYIN_SANS,
    fontSize: 18,
    fontWeight: "600",
  },
  message: {
    marginTop: 8,
    color: "#777",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  button: {
    alignSelf: "stretch",
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginTop: 20,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF3158",
  },
  actions: {
    flexShrink: 0,
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    marginTop: 0,
    alignSelf: "auto",
    backgroundColor: "#F5F5F5",
  },
  confirmButton: { flex: 1, marginTop: 0, alignSelf: "auto" },
  singleButton: { flex: 1, marginTop: 0, alignSelf: "auto" },
  cancelText: {
    color: "#333",
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
    fontWeight: "600",
  },
  buttonText: {
    textAlign: "center",
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
    fontWeight: "600",
  },
});
