import { DismissCircle16Filled } from "@fluentui/react-native-icons";
import { useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  computeFreeStarAmount,
  computeOrderPayableStars,
  parseHoursLive,
  sanitizeHoursText,
} from "@/features/order/free-amount";
import type { OrderItemModel } from "@/features/order/order.types";
import { SYSTEM_FONT } from "@/shared/theme/typography";

type Props = {
  visible: boolean;
  order: OrderItemModel;
  loading: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  onConfirm: (freeHours: number) => void;
};

/** 免单个数输入弹窗，输入数量按订单单价换算为接口需要的星钻金额 */
export function OrderFreeConfirmDialog({
  visible,
  order,
  loading,
  onClose,
  onDismiss,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [hoursText, setHoursText] = useState("");
  const freeHours = parseHoursLive(hoursText);
  const freeStars = computeFreeStarAmount(order, freeHours ?? 0);
  const payableStars = computeOrderPayableStars(order);
  const exceedsQuantity = freeHours != null && freeHours > order.quantity;
  const exceedsAmount = freeStars != null && freeStars > payableStars;
  const valid = freeStars != null && !exceedsQuantity && !exceedsAmount;
  const error = exceedsQuantity
    ? "免单个数不能超过订单数量"
    : exceedsAmount
      ? "免单金额不能超过剩余应收金额"
      : "";

  const handleClose = () => {
    if (loading) {
      return;
    }
    Keyboard.dismiss();
    onClose();
  };
  const handleConfirm = () => {
    if (loading || !valid || freeHours == null) {
      return;
    }
    Keyboard.dismiss();
    onConfirm(freeHours);
  };
  const handleShow = () => {
    inputRef.current?.focus();
  };
  const handleClear = () => {
    setHoursText("");
    inputRef.current?.focus();
  };
  const handleChange = (text: string) => {
    setHoursText(sanitizeHoursText(text));
  };

  return (
    <Modal
      transparent
      statusBarTranslucent
      animationType="fade"
      visible={visible}
      onRequestClose={handleClose}
      onDismiss={onDismiss}
      onShow={handleShow}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.backdrop}
      >
        <Pressable
          accessibilityLabel="关闭免单弹窗"
          disabled={loading}
          onPress={handleClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.safeArea,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
          ]}
          pointerEvents="box-none"
        >
          <View accessibilityViewIsModal style={styles.dialog}>
            <View style={styles.content}>
              <Text accessibilityRole="header" style={styles.title}>
                免单个数
              </Text>
              <View style={styles.inputBox}>
                <TextInput
                  ref={inputRef}
                  accessibilityLabel="免单个数"
                  editable={!loading}
                  keyboardType="decimal-pad"
                  maxLength={8}
                  onChangeText={handleChange}
                  onSubmitEditing={handleConfirm}
                  placeholder="请输入免单个数"
                  placeholderTextColor="#CCCCCC"
                  selectionColor="#FE1F4C"
                  style={styles.input}
                  value={hoursText}
                />
                {hoursText ? (
                  <Pressable
                    accessibilityLabel="清空免单个数"
                    accessibilityRole="button"
                    disabled={loading}
                    hitSlop={8}
                    onPress={handleClear}
                  >
                    <DismissCircle16Filled
                      color="#999999"
                      width={18}
                      height={18}
                    />
                  </Pressable>
                ) : null}
              </View>
              {error ? (
                <Text accessibilityLiveRegion="polite" style={styles.error}>
                  {error}
                </Text>
              ) : null}
            </View>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={handleClose}
                style={[styles.button, styles.cancelButton]}
              >
                <Text style={[styles.buttonText, styles.cancelText]}>取消</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: loading || !valid }}
                disabled={loading || !valid}
                onPress={handleConfirm}
                style={[
                  styles.button,
                  styles.confirmButton,
                  (loading || !valid) && styles.disabledButton,
                ]}
              >
                <Text style={styles.buttonText}>
                  {loading ? "处理中..." : "确认免单"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)" },
  safeArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  dialog: {
    width: "100%",
    maxWidth: 295,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFF",
  },
  content: { padding: 16, gap: 12 },
  title: {
    color: "#333333",
    fontFamily: SYSTEM_FONT,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
    textAlign: "center",
  },
  inputBox: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    color: "#0A0A0A",
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    lineHeight: 22,
  },
  error: {
    color: "#FE1F4C",
    fontFamily: SYSTEM_FONT,
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 4,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  button: {
    flex: 1,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "#FE1F4C",
    backgroundColor: "#FFF",
  },
  confirmButton: { backgroundColor: "#FE1F4C" },
  disabledButton: { opacity: 0.5 },
  buttonText: {
    color: "#FFF",
    fontFamily: SYSTEM_FONT,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
  },
  cancelText: { color: "#FE1F4C" },
});
