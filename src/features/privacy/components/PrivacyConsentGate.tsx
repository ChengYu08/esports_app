import { useCallback, useState } from "react";
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import { colors } from "@/shared/theme/tokens";
import { APP_LINKS } from "@/core/config/links";
import { savePrivacyConsent } from "@/features/privacy/privacy-consent";
import { openExternalLink } from "@/shared/navigation/open-external-link";

type PrivacyConsentGateProps = {
  onAccepted: () => void;
};

export function PrivacyConsentGate({ onAccepted }: PrivacyConsentGateProps) {
  const [saving, setSaving] = useState(false);

  const handleAccept = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await savePrivacyConsent();
      onAccepted();
    } catch {
      // Keep the gate open when consent could not be persisted.
      setSaving(false);
    }
  }, [onAccepted, saving]);

  const handleDecline = useCallback(() => {
    // Android supports an explicit app exit. iOS does not expose an approved
    // programmatic exit API, so this remains a no-op there.
    BackHandler.exitApp();
  }, []);

  return (
    <Modal
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible
      onRequestClose={() => undefined}
    >
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.card}>
          <Text style={styles.title}>个人信息提示</Text>
          <ScrollView
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator
            style={styles.bodyScroll}
          >
            <Text style={styles.body}>友情提示</Text>
            <Text style={styles.body}>欢迎登录盼之电竞APP！</Text>
            <Text style={styles.body}>
              盼之电竞重视保障您的个人隐私，我们依据最新的监管要求更新了盼之电竞APP的
              <Text
                accessibilityRole="link"
                onPress={() => void openExternalLink(APP_LINKS.userAgreement)}
                style={styles.link}
              >
                《用户协议》
              </Text>
              和
              <Text
                accessibilityRole="link"
                onPress={() => void openExternalLink(APP_LINKS.privacyPolicy)}
                style={styles.link}
              >
                《隐私政策》
              </Text>
              ，以下将向你说明：
            </Text>
            <Text style={styles.body}>
              1.为保障应用安全、稳定运行，我们可能会收集您的设备信息、IP 地址和 MAC 地址。；
            </Text>
            <Text style={styles.body}>
              2.使用客服功能时，为确保您在应用关闭或处于后台时仍能及时接收消息，本应用可能需要使用自启动或关联启动能力，并通过系统广播唤醒或启动应用。该能力仅用于实现消息推送等必要功能。；
            </Text>
            <Text style={styles.body}>
              3.我们尊重并保障您的选择权。您可以访问、更正、删除个人信息，管理个人信息授权；同时，我们为您提供账号注销和投诉反馈渠道
            </Text>
            <Text style={styles.body}>
              4.未经你的同意，我们不会从第三方获取、共享或向其提供你的信息；
            </Text>
            <Text style={styles.body}>
              5.你可以随时访问、修改和删除你的个人信息，同时我们也提供注销、隐身和投诉等方式。详情请查看
              <Text
                accessibilityRole="link"
                onPress={() => void openExternalLink(APP_LINKS.userAgreement)}
                style={styles.link}
              >
                《用户协议》
              </Text>
              <Text
                accessibilityRole="link"
                onPress={() => void openExternalLink(APP_LINKS.privacyPolicy)}
                style={styles.link}
              >
                《隐私政策》
              </Text>
              ）
            </Text>
          </ScrollView>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="不同意，退出应用"
              disabled={saving}
              onPress={handleDecline}
              style={({ pressed }) => [styles.declineButton, pressed && styles.pressed]}
            >
              <Text style={styles.declineText}>不同意，退出应用</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="同意并继续使用"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={() => void handleAccept()}
              style={({ pressed }) => [styles.acceptButton, pressed && styles.pressed]}
            >
              <Text style={styles.acceptText}>{saving ? "保存中…" : "同意"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.textStrong,
    fontFamily: DOUYIN_SANS,
    fontSize: 19,
    fontWeight: "600",
    lineHeight: 28,
    textAlign: "center",
  },
  body: {
    color: colors.textSecondary,
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 23,
  },
  bodyScroll: {
    maxHeight: 420,
    marginTop: 14,
  },
  bodyContent: {
    gap: 10,
  },
  link: { color: colors.brand },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  declineButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  acceptButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.brand,
  },
  declineText: {
    color: colors.textSecondary,
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
  },
  acceptText: {
    color: colors.surface,
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    fontWeight: "600",
  },
  pressed: { opacity: 0.78 },
});
