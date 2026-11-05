import { Image } from "expo-image";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

const microphoneIcon = require("../../../../assets/svgs/toolbar-mic.svg");
const microphoneMuteIcon = require("../../../../assets/svgs/toolbar-mic-mute.svg");

type MicControlProps = {
  muted: boolean;
  ready: boolean;
  connecting: boolean;
  pending: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function VoiceRoomMicControl({
  muted,
  ready,
  connecting,
  pending,
  disabled = false,
  onPress,
}: MicControlProps) {
  const busy = pending || (!ready && connecting);
  const unavailable = !ready || disabled || busy;
  const color = !ready ? "#9296AA" : muted ? "#FF6D8C" : "#F4F5FF";
  const label = pending
    ? "切换中"
    : !ready
      ? connecting
        ? "连接中"
        : "未连接"
      : muted
        ? "已闭麦"
        : "已开麦";

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={`麦克风，${label}`}
      accessibilityHint={
        ready
          ? muted
            ? "点击打开麦克风"
            : "点击关闭麦克风"
          : "语音连接就绪后可开麦"
      }
      accessibilityState={{ checked: ready && !muted, disabled: unavailable, busy }}
      aria-checked={ready && !muted}
      aria-busy={busy}
      aria-disabled={unavailable}
      disabled={unavailable}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.control,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} style={styles.controlIcon} />
      ) : (
        <Image
          source={ready && !muted ? microphoneIcon : microphoneMuteIcon}
          style={styles.controlIcon}
          contentFit="contain"
        />
      )}
    </Pressable>
  );
}

export function VoiceRoomMicBadge({
  muted,
  speaking = false,
}: {
  muted: boolean;
  speaking?: boolean;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.badge,
        !muted && styles.badgeOpen,
        !muted && speaking && styles.badgeSpeaking,
      ]}
    >
      <Image
        source={muted ? microphoneMuteIcon : microphoneIcon}
        style={styles.badgeIcon}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  control: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    flexShrink: 0,
  },
  controlIcon: {
    width: 20,
    height: 20,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.8,
  },
  badge: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#11102F",
    backgroundColor: "#28273F",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeOpen: {
    backgroundColor: "#44415F",
  },
  badgeSpeaking: {
    backgroundColor: "#0C7A3F",
  },
  badgeIcon: {
    width: 14,
    height: 14,
  },
});
