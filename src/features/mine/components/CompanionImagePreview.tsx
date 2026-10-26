import { Dismiss24Regular } from "@fluentui/react-native-icons";
import { Image } from "expo-image";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ManagedImage } from "../api/companion-management.contract";

export function CompanionImagePreview({
  image,
  onClose,
}: {
  image: ManagedImage | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={image !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {image ? (
          <Image
            source={{ uri: image.imageUrl }}
            contentFit="contain"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <Pressable
          accessibilityLabel="关闭图片预览"
          accessibilityRole="button"
          onPress={onClose}
          style={[styles.close, { top: insets.top + 8 }]}
        >
          <Dismiss24Regular color="#FFF" width={24} height={24} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#000" },
  close: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,.5)",
  },
});
