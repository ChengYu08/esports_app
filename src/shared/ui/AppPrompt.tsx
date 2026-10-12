import { DOUYIN_SANS } from "@/shared/theme/typography";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

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
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onCancel ?? onConfirm}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            {cancelText && onCancel && (
              <Pressable
                style={[styles.button, styles.cancelButton]}
                onPress={onCancel}
              >
                <Text style={styles.cancelText}>{cancelText}</Text>
              </Pressable>
            )}
            <Pressable
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
    borderRadius: 20,
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
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
    height: 44,
    marginTop: 20,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF3158",
  },
  actions: {
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
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 15,
    fontWeight: "600",
  },
});
