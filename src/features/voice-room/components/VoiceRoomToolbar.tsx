import { Image } from "expo-image";
import {
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { VoiceRoomMicControl } from "./VoiceRoomMicrophone";

const sendIcon = require("../../../../assets/voice-room/toolbar-send.svg");
const messageIcon = require("../../../../assets/voice-room/toolbar-message.svg");
const inviteIcon = require("../../../../assets/voice-room/toolbar-invite.svg");

type VoiceRoomToolbarProps = {
  bottomInset: number;
  input: string;
  muted: boolean;
  rtcReady: boolean;
  connecting: boolean;
  micChanging: boolean;
  leaving: boolean;
  serviceCalling: boolean;
  distanceEnabled: boolean;
  onToggleDistance: () => void;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onToggleMute: () => void;
  onOpenMessages: () => void;
  onInvite: () => void;
  onCallService: () => void;
};

export function VoiceRoomToolbar({
  bottomInset,
  input,
  muted,
  rtcReady,
  connecting,
  micChanging,
  leaving,
  serviceCalling,
  distanceEnabled,
  onToggleDistance,
  onChangeText,
  onSend,
  onToggleMute,
  onOpenMessages,
  onInvite,
  onCallService,
}: VoiceRoomToolbarProps) {
  const { width } = useWindowDimensions();
  const compact = width < 360;

  return (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
        { paddingBottom: Math.max(bottomInset, 12) },
      ]}
    >
      <View style={[styles.composer, compact && styles.composerCompact]}>
        <TextInput
          accessibilityLabel="语聊房消息"
          value={input}
          onChangeText={onChangeText}
          onSubmitEditing={onSend}
          returnKeyType="send"
          placeholder="聊聊"
          placeholderTextColor="#979799"
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="发送消息"
          onPress={onSend}
          hitSlop={8}
          style={styles.sendButton}
        >
          <Image source={sendIcon} style={styles.icon} contentFit="contain" />
        </Pressable>
      </View>
      <View style={[styles.tools, compact && styles.toolsCompact]}>
        <VoiceRoomMicControl
          muted={muted}
          ready={rtcReady}
          connecting={connecting}
          pending={micChanging}
          disabled={leaving}
          onPress={onToggleMute}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="打开消息列表"
          onPress={onOpenMessages}
          hitSlop={4}
          style={({ pressed }) => [
            styles.toolButton,
            pressed && styles.pressed,
          ]}
        >
          <Image
            source={messageIcon}
            style={styles.icon}
            contentFit="contain"
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="邀请用户"
          onPress={onInvite}
          hitSlop={4}
          style={({ pressed }) => [
            styles.toolButton,
            pressed && styles.pressed,
          ]}
        >
          <Image source={inviteIcon} style={styles.icon} contentFit="contain" />
        </Pressable>
      </View>
      {/* <Pressable
        accessibilityRole="button"
        accessibilityLabel="客服派单"
        accessibilityState={{ disabled: serviceCalling, busy: serviceCalling }}
        disabled={serviceCalling}
        onPress={onCallService}
        hitSlop={4}
        style={({ pressed }) => [
          styles.serviceButton,
          serviceCalling && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <LinearGradient
          colors={["#FF1F2E", "#FF1F69"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.serviceContent,
            compact && styles.serviceContentCompact,
          ]}
        >
          <Image
            source={serviceIcon}
            style={styles.serviceIcon}
            contentFit="contain"
          />
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
            style={[styles.serviceText, compact && styles.serviceTextCompact]}
          >
            {serviceCalling ? "呼叫中…" : "客服派单"}
          </Text>
        </LinearGradient>
      </Pressable> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    marginBottom: 40,
  },
  containerCompact: { gap: 8, paddingHorizontal: 12 },
  composer: {
    flex: 1,
    minWidth: 0,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  composerCompact: { paddingHorizontal: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 36,
    padding: 0,
    color: "#FFFFFF",
    fontSize: 12,
  },
  sendButton: {
    flexShrink: 0,
    width: 20,
    height: 36,
    justifyContent: "center",
  },
  tools: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  toolsCompact: { gap: 6 },
  toolButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  distanceActive: {
    backgroundColor: "rgba(255,165,0,0.2)",
    borderColor: "#FFA500",
    borderWidth: 1,
  },
  distanceIcon: {
    tintColor: "#FFA500",
  },
  icon: { width: 20, height: 20 },
  serviceButton: { flexShrink: 0, borderRadius: 18 },
  serviceContent: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: 18,
  },
  serviceContentCompact: { paddingRight: 8 },
  serviceIcon: { width: 22, height: 22 },
  serviceText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  serviceTextCompact: { fontSize: 12 },
  disabled: { opacity: 0.62 },
  pressed: { opacity: 0.8 },
});
