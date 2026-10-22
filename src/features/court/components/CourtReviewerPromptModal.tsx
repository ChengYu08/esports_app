import { courtApi } from "@/features/court/court.api";
import { DOUYIN_SANS } from "@/shared/theme/typography";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Toast from "react-native-root-toast";

type Props = { visible: boolean; onClose: () => void };

export function CourtReviewerPromptModal({ visible, onClose }: Props) {
  const [submitting, setSubmitting] = useState(false);

  async function apply() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await courtApi.applyReviewer();
      Toast.show("评审员申请已提交", { duration: Toast.durations.SHORT });
      onClose();
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : "申请失败", {
        duration: Toast.durations.SHORT,
      });
    } finally {
      setSubmitting(false);
    }
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
            当前暂无投票资格，是否申请成为评审员？
          </Text>
          <View style={styles.actions}>
            <Pressable
              disabled={submitting}
              onPress={onClose}
              style={[styles.button, styles.cancel]}
            >
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
            <Pressable
              disabled={submitting}
              onPress={apply}
              style={[styles.button, styles.confirm]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmText}>申请</Text>
              )}
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
    backgroundColor: "rgba(0,0,0,0.58)",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  dialog: {
    backgroundColor: "#fff",
    borderRadius: 10,
    maxWidth: 340,
    paddingHorizontal: 16,
    paddingTop: 18,
    width: "100%",
  },
  title: {
    color: "#222",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  message: {
    color: "#666",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    minHeight: 36,
  },
  actions: { flexDirection: "row", gap: 8, marginBottom: 12, marginTop: 8 },
  button: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    height: 34,
    justifyContent: "center",
  },
  cancel: { backgroundColor: "#fff", borderColor: "#ff3158", borderWidth: 1 },
  cancelText: {
    color: "#ff3158",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "500",
  },
  confirm: { backgroundColor: "#ff3158" },
  confirmText: {
    color: "#fff",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    fontWeight: "600",
  },
});
