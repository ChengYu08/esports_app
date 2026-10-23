import { router } from "expo-router";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = { visible: boolean; onClose: () => void };

export function CourtReviewerPromptModal({ visible, onClose }: Props) {
  function openReviewer() {
    onClose();
    router.push("/court/reviewer");
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View accessibilityRole="alert" style={styles.dialog}>
          <Text style={styles.title}>成为评审员</Text>
          <Text style={styles.message}>
            {"当前暂无投票资格，是否申请成为评审\n员？"}
          </Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={[styles.button, styles.cancel]}
            >
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
            <Pressable
              onPress={openReviewer}
              style={[styles.button, styles.confirm]}
            >
              <Text style={styles.confirmText}>申请</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  dialog: {
    backgroundColor: "#fff",
    borderRadius: 12,
    maxWidth: "100%",
    padding: 16,
    width: 300,
  },
  title: {
    color: "#333",
    fontFamily: "PingFang SC",
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 24,
    textAlign: "center",
  },
  message: {
    color: "#666",
    fontFamily: "PingFang SC",
    fontSize: 14,
    fontStyle: "normal",
    fontWeight: "400",
    lineHeight: 22,
    marginTop: 14,
  },
  actions: { flexDirection: "row", gap: 12, marginTop: 12 },
  button: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    minHeight: 36,
    paddingVertical: 7,
    justifyContent: "center",
  },
  cancel: { backgroundColor: "#fff", borderColor: "#FE1F4C", borderWidth: 1 },
  cancelText: {
    color: "#FE1F4C",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  confirm: { backgroundColor: "#FE1F4C" },
  confirmText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
});
