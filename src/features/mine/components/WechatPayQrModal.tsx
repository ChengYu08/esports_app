import { Dismiss24Regular } from "@fluentui/react-native-icons";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCodeSvg from "react-native-qrcode-svg";
import { showToast, toastDurations } from "@/shared/ui/app-toast";
import { captureRef } from "react-native-view-shot";

import { DOUYIN_SANS } from "@/shared/theme/typography";

const appIcon = require("../../../../assets/images/icon.png");

type SaveStatus = "idle" | "saving" | "failed";

export function WechatPayQrModal({
  visible,
  qrCode,
  moneyAmount,
  starAmount,
  onClose,
}: {
  visible: boolean;
  qrCode: string;
  moneyAmount: number;
  starAmount: number;
  onClose: () => void;
}) {
  const qrCardRef = useRef<View>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");

  function resetState() {
    setSaving(false);
    setStatus("idle");
  }

  function close() {
    if (saving) return;
    resetState();
    onClose();
  }

  async function saveToAlbum() {
    if (saving) return;
    setSaving(true);
    setStatus("saving");
    try {
      const base64 = await captureRef(qrCardRef, {
        format: "png",
        quality: 1,
        result: "base64",
      });
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        setStatus("failed");
        return;
      }
      // 自定义文件名入库，避免相册显示 ReactNative_snapshot 默认名
      const file = new File(Paths.cache, `PZDJ_snapshot_${Date.now()}.png`);
      file.create();
      file.write(base64, { encoding: "base64" });
      try {
        await MediaLibrary.Asset.create(file.uri);
      } finally {
        if (file.exists) {
          file.delete();
        }
      }
      resetState();
      onClose();
      showToast("已保存到相册，请打开微信扫一扫，从相册选取二维码完成支付", {
        duration: toastDurations.LONG,
      });
    } catch {
      setStatus("failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="关闭微信支付弹窗"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>微信扫码支付</Text>
            <Pressable
              accessibilityLabel="关闭"
              hitSlop={10}
              onPress={close}
              style={styles.closeButton}
            >
              <Dismiss24Regular color="#999999" height={20} width={20} />
            </Pressable>
          </View>
          <Text style={styles.summary}>
            ¥{moneyAmount} 充值 {starAmount} 星钻
          </Text>
          <View ref={qrCardRef} collapsable={false} style={styles.qrCard}>
            <QRCodeSvg
              value={qrCode}
              size={200}
              backgroundColor="#FFFFFF"
              logo={appIcon}
              logoSize={44}
              logoBackgroundColor="#FFFFFF"
              logoMargin={4}
              logoBorderRadius={8}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={() => {
              void saveToAlbum();
            }}
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>保存到相册</Text>
            )}
          </Pressable>
          <Text style={styles.hint}>
            {status === "failed"
              ? "保存失败，请重试"
              : "点击保存到相册后，打开微信扫一扫，从相册选取二维码完成支付"}
          </Text>
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
    paddingHorizontal: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  card: {
    width: "100%",
    maxWidth: 327,
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
  },
  header: {
    width: "100%",
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#0A0A0A",
    fontFamily: DOUYIN_SANS,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
  },
  closeButton: {
    position: "absolute",
    right: 0,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  summary: {
    marginTop: 8,
    color: "#656566",
    fontFamily: DOUYIN_SANS,
    fontSize: 13,
    lineHeight: 20,
  },
  qrCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  saveButton: {
    marginTop: 16,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#FE1F4C",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonText: {
    color: "#FFFFFF",
    fontFamily: DOUYIN_SANS,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  hint: {
    marginTop: 12,
    color: "#979799",
    fontFamily: DOUYIN_SANS,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
