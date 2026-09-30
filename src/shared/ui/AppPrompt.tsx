import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { DOUYIN_SANS } from "@/shared/theme/typography";

export function AppPrompt({
  visible,
  title = "提示",
  message,
  confirmText = "知道了",
  onConfirm,
}: {
  visible: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onConfirm}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.icon}><Text style={styles.iconText}>!</Text></View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable style={styles.button} onPress={onConfirm}><Text style={styles.buttonText}>{confirmText}</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36, backgroundColor: "rgba(0,0,0,0.48)" },
  dialog: { width: "100%", borderRadius: 20, alignItems: "center", padding: 24, backgroundColor: "#fff" },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1F3" },
  iconText: { color: "#FF3158", fontSize: 28, fontWeight: "700" },
  title: { marginTop: 14, color: "#111", fontFamily: DOUYIN_SANS, fontSize: 18, fontWeight: "600" },
  message: { marginTop: 8, color: "#777", fontFamily: DOUYIN_SANS, fontSize: 14, lineHeight: 21, textAlign: "center" },
  button: { alignSelf: "stretch", height: 44, marginTop: 20, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#FF3158" },
  buttonText: { color: "#fff", fontFamily: DOUYIN_SANS, fontSize: 15, fontWeight: "600" },
});
