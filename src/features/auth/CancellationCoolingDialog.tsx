import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { formatCoolEndTime } from "./cancellation-cooling";
import type { CoolingRecord } from "./cancellation-cooling";
import { colors } from "@/shared/theme/tokens";

export function CancellationCoolingDialog({
  record,
  visible,
  onCancel,
  onAbandon,
}: {
  record: CoolingRecord;
  visible: boolean;
  onCancel: () => void;
  onAbandon: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>该账号正处于注销冷静期</Text>
          <Text style={styles.body}>
            账号已提交注销申请，将于
            <Text style={styles.highlight}>
              {` ${formatCoolEndTime(record.coolEndTime)} `}
            </Text>
            完成注销，若此时登陆该账号视为取消注销。
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="取消"
              onPress={onCancel}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="放弃注销并登录"
              onPress={onAbandon}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryText}>放弃注销并登录</Text>
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
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  dialog: {
    width: "100%",
    maxWidth: 295,
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#FFF",
  },
  title: {
    color: "#0A0A0A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    textAlign: "center",
  },
  body: {
    color: "#666666",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 12,
  },
  highlight: { color: "#FE1F4C", fontWeight: "500" },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    width: 96,
    height: 36,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  cancelText: {
    color: "#0A0A0A",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  primaryButton: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  primaryText: {
    color: "#FFF",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
});
