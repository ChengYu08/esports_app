import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

import { DOUYIN_SANS } from "@/shared/theme/typography";

const promoIllustration = require("../../../../assets/mine/figma/teen-promo-illustration.png");

/**
 * 青少年模式每日首启促销弹窗（设计稿 571-59836）：
 * 勾选"后续不再重复弹出"后任一按钮关闭均记录 dontAsk；否则仅记录当日已弹。
 */
export function TeenModePromoDialog({
  visible,
  onClose,
  onGoEnable,
}: {
  visible: boolean;
  /** 关闭回调：参数为用户是否勾选了"后续不再重复弹出"。 */
  onClose: (dontAsk: boolean) => void;
  onGoEnable: (dontAsk: boolean) => void;
}) {
  const [dontAsk, setDontAsk] = useState(false);

  const dismiss = (goEnable: boolean) => {
    onClose(dontAsk);
    if (goEnable) {
      onGoEnable(dontAsk);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => dismiss(false)}
    >
      {/* 吞掉底层点击：弹窗期间不可操作 App */}
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Image
            source={promoIllustration}
            contentFit="contain"
            style={styles.illustration}
          />
          <View style={styles.textArea}>
            <Text style={styles.title}>青少年模式</Text>
            <Text style={styles.body}>
              为呵护未成年人健康成长，盼之电竞推出青少年模式，该模式下应用核心功能无法使用，请监护人主动选择并设置独立密码
            </Text>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: dontAsk }}
              accessibilityLabel="后续不再重复弹出"
              onPress={() => setDontAsk((checked) => !checked)}
              style={styles.checkboxRow}
            >
              <View style={styles.checkboxRing}>
                {dontAsk ? <View style={styles.checkboxDot} /> : null}
              </View>
              <Text style={styles.checkboxLabel}>后续不再重复弹出</Text>
            </Pressable>
          </View>
          <View style={styles.buttonGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="去开启"
              onPress={() => dismiss(true)}
              style={[styles.button, styles.goEnableButton]}
            >
              <Text style={styles.goEnableText}>去开启</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="我知道了"
              onPress={() => dismiss(false)}
              style={[styles.button, styles.knownButton]}
            >
              <Text style={styles.knownText}>我知道了</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** 设计稿插画（illustration-minor mode 切图）。 */

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  dialog: {
    width: "100%",
    maxWidth: 295,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  illustration: {
    width: 240,
    height: 103,
    alignSelf: "center",
    marginTop: 12,
  },
  textArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  body: {
    color: "#666666",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  checkboxRow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  checkboxRing: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CCCCCC",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E01B28",
  },
  checkboxLabel: {
    color: "#808080",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  button: {
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  goEnableButton: {
    flex: 96,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9E9EB",
  },
  goEnableText: {
    color: "#333333",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  knownButton: {
    flex: 155,
    backgroundColor: "#FE1F4C",
  },
  knownText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
});
