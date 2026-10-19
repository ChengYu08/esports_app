import { Image } from "expo-image";
import { router } from "expo-router";
import { memo, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useInAppNotification,
} from "../notification-hub";
import { getConversationAvatarUri } from "../message-avatar";

const defaultAvatar = require("../../../../assets/coms/avatar_default.webp");
const systemNotificationAvatar = require("../../../../assets/message/message-system-notice.svg");
const AUTO_DISMISS_MS = 4000;

function InAppNotificationBannerImpl({ visible = true }: { visible?: boolean }) {
  const insets = useSafeAreaInsets();
  const notification = useInAppNotification((state) => state.notification);
  const dismiss = useInAppNotification((state) => state.dismiss);
  const [failedAvatarKey, setFailedAvatarKey] = useState<string | null>(null);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notification, dismiss]);

  if (!notification || !visible) return null;

  const handlePress = () => {
    dismiss();
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: notification.peerId,
        title: notification.title,
      },
    });
  };

  const avatarUri = getConversationAvatarUri(notification.avatar);
  const isSystem = notification.isSystem;
  const avatarError = failedAvatarKey === notification.key;

  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="box-none"
      style={[
        styles.overlay,
        { top: insets.top + (Platform.OS === "android" ? 8 : 4) },
      ]}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.banner, pressed && styles.bannerPressed]}
        accessibilityRole="alert"
        accessibilityLabel={`${notification.title}：${notification.preview}`}
      >
        <Image
          source={
            avatarUri && !avatarError
              ? { uri: avatarUri }
              : isSystem
                ? systemNotificationAvatar
                : defaultAvatar
          }
          style={styles.avatar}
          onError={() => setFailedAvatarKey(notification.key)}
          recyclingKey={notification.key}
        />
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.preview} numberOfLines={2}>
            {notification.preview}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export const InAppNotificationBanner = memo(InAppNotificationBannerImpl);

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 1000,
    elevation: 1000,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderRadius: 16,
    padding: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 12,
  },
  bannerPressed: {
    opacity: 0.85,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  preview: {
    fontSize: 13,
    color: "#666",
  },
});
