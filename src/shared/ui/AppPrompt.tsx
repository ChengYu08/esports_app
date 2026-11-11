import { useEffect } from "react";
import {
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BRAND = "#FE1F4C";

export function AppPrompt({
  visible,
  inline = false,
  title = "提示",
  message,
  confirmText = "知道了",
  cancelText,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  /** 内嵌模式：不用原生 Modal，作为绝对定位覆盖层渲染在宿主原生 Modal 内（iOS 无法同时呈现两个原生 Modal，弹层内提示必须走此模式） */
  inline?: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onCancel?: () => void;
  onConfirm: () => void;
}) {
  const insets = useSafeAreaInsets();

  // 内嵌模式没有原生 Modal 的 onRequestClose，Android 返回键需自行接管
  useEffect(() => {
    if (!inline || !visible) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      (onCancel ?? onConfirm)();
      return true;
    });
    return () => subscription.remove();
  }, [inline, visible, onCancel, onConfirm]);

  const content = (
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
  );

  if (inline) {
    if (!visible) return null;
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {content}
      </View>
    );
  }

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onCancel ?? onConfirm}
    >
      {content}
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
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
    textAlign: "center",
  },
  message: {
    color: "#666666",
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
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
    textAlign: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
    textAlign: "center",
  },
});
