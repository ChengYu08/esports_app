import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { VoiceRoomMicControl } from "./VoiceRoomMicrophone";

const sendIcon = require("../../../../assets/voice-room/toolbar-send.svg");
const messageIcon = require("../../../../assets/voice-room/toolbar-message.svg");
const inviteIcon = require("../../../../assets/voice-room/toolbar-invite.svg");
const selectCompanionIcon = require("../../../../assets/voice-room/toolbar-select-companion.svg");

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
  showSelectCompanion?: boolean;
  onToggleDistance: () => void;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onToggleMute: () => void;
  onOpenMessages: () => void;
  onInvite: () => void;
  onCallService: () => void;
  onSelectCompanion?: () => void;
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
  showSelectCompanion = false,
  onToggleDistance,
  onChangeText,
  onSend,
  onToggleMute,
  onOpenMessages,
  onInvite,
  onCallService,
  onSelectCompanion,
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
      {showSelectCompanion ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="选择陪玩"
          disabled={leaving}
          onPress={onSelectCompanion}
          hitSlop={4}
          style={({ pressed }) => [
            styles.selectCompanionButton,
            leaving && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <LinearGradient
            colors={["#FF1F2E", "#FF1F69"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.selectCompanionContent,
              compact && styles.selectCompanionContentCompact,
            ]}
          >
            <Image
              source={selectCompanionIcon}
              style={styles.selectCompanionIcon}
              contentFit="contain"
            />
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}
              style={[
                styles.selectCompanionText,
                compact && styles.selectCompanionTextCompact,
              ]}
            >
              选择陪玩
            </Text>
          </LinearGradient>
        </Pressable>
      ) : null}
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
  selectCompanionButton: { flexShrink: 0, borderRadius: 18 },
  selectCompanionContent: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: 18,
  },
  selectCompanionContentCompact: { paddingRight: 8 },
  selectCompanionIcon: { width: 22, height: 22 },
  selectCompanionText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  selectCompanionTextCompact: { fontSize: 12 },
  disabled: { opacity: 0.62 },
  pressed: { opacity: 0.8 },
});
