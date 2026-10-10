import { useCallback, useState } from "react";
import { BackHandler, Modal, Pressable, StyleSheet, Text, View } from "react-native";

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
          <Text style={styles.title}>隐私保护提示</Text>
          <Text style={styles.body}>
            为了向你提供更好的服务，我们会按照
            <Text
              accessibilityRole="link"
              onPress={() => void openExternalLink(APP_LINKS.privacyPolicy)}
              style={styles.link}
            >
              《隐私政策》
            </Text>
            收集、使用和保护你的相关信息。
            请你阅读并同意相关协议后继续使用盼之电竞。你可以随时在设置中查看或管理你的隐私设置。
          </Text>
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
    marginTop: 14,
    color: colors.textSecondary,
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 23,
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
