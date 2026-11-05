import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { VoiceRoomMicControl } from "./VoiceRoomMicrophone";

const sendIcon = require("../../../../assets/svgs/toolbar-send.svg");
const messageIcon = require("../../../../assets/svgs/toolbar-message.svg");
const inviteIcon = require("../../../../assets/svgs/toolbar-invite.svg");
const selectCompanionIcon = require("../../../../assets/svgs/toolbar-select-companion.svg");
/** Figma 542:121702 / 542:121821：接待派单左侧耳机图标 */
const dispatchIcon = require("../../../../assets/svgs/toolbar-dispatch.svg");

type VoiceRoomToolbarProps = {
  bottomInset: number;
  muted: boolean;
  rtcReady: boolean;
  connecting: boolean;
  micChanging: boolean;
  leaving: boolean;
  serviceCalling: boolean;
  distanceEnabled: boolean;
  /** 房主且房内尚无接待时展示「接待派单」 */
  showCallService?: boolean;
  /** 当前用户为房间绑定接待时展示「客服派单」 */
  showServiceDispatch?: boolean;
  showSelectCompanion?: boolean;
  /** 一键匹配抢单人数；>0 时按钮文案为「选择陪玩(N)」 */
  selectCompanionGrabCount?: number;
  /** 点击「聊聊」假输入胶囊，唤起键盘评论面板 */
  onCommentPress: () => void;
  onToggleDistance: () => void;
  onToggleMute: () => void;
  onOpenMessages: () => void;
  onInvite: () => void;
  onCallService: () => void;
  onServiceDispatch?: () => void;
  onSelectCompanion?: () => void;
};

export function VoiceRoomToolbar({
  bottomInset,
  muted,
  rtcReady,
  connecting,
  micChanging,
  leaving,
  serviceCalling,
  distanceEnabled,
  showCallService = false,
  showServiceDispatch = false,
  showSelectCompanion = false,
  selectCompanionGrabCount = 0,
  onCommentPress,
  onToggleDistance,
  onToggleMute,
  onOpenMessages,
  onInvite,
  onCallService,
  onServiceDispatch,
  onSelectCompanion,
}: VoiceRoomToolbarProps) {
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const selectCompanionLabel =
    selectCompanionGrabCount > 0
      ? `选择陪玩(${selectCompanionGrabCount})`
      : "选择陪玩";

  return (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
        {
          paddingBottom: Math.max(bottomInset, 12),
        },
      ]}
    >
      {/* Figma 51:15881「底部栏」：假输入胶囊，点击唤起键盘评论面板 */}
      <Pressable
        accessibilityLabel="聊聊"
        accessibilityRole="button"
        onPress={onCommentPress}
        style={({ pressed }) => [
          styles.composer,
          compact && styles.composerCompact,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.composerPlaceholder}>聊聊</Text>
        <Image source={sendIcon} style={styles.icon} contentFit="contain" />
      </Pressable>
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
      {showCallService ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={serviceCalling ? "邀请中" : "接待派单"}
          accessibilityState={{ disabled: serviceCalling || leaving, busy: serviceCalling }}
          disabled={serviceCalling || leaving}
          onPress={onCallService}
          hitSlop={4}
          style={({ pressed }) => [
            styles.dispatchButton,
            leaving && !serviceCalling && styles.disabled,
            pressed && !serviceCalling && styles.pressed,
          ]}
        >
          <LinearGradient
            colors={["#FF1F2E", "#FF1F69"]}
            start={{ x: 0.12, y: 0 }}
            end={{ x: 1.08, y: 1 }}
            style={[
              styles.dispatchContent,
              compact && styles.dispatchContentCompact,
            ]}
          >
            <Image
              source={dispatchIcon}
              style={styles.dispatchIcon}
              contentFit="contain"
            />
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}
              style={[
                styles.dispatchText,
                compact && styles.dispatchTextCompact,
              ]}
            >
              {serviceCalling ? "邀请中" : "接待派单"}
            </Text>
            {/* Figma 542:121821：邀请中态叠加 30% 白蒙层 */}
            {serviceCalling ? (
              <View pointerEvents="none" style={styles.dispatchCallingOverlay} />
            ) : null}
          </LinearGradient>
        </Pressable>
      ) : null}
      {showServiceDispatch ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="客服派单"
          disabled={leaving}
          onPress={onServiceDispatch}
          hitSlop={4}
          style={({ pressed }) => [
            styles.actionPillButton,
            leaving && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <LinearGradient
            colors={["#FF1F2E", "#FF1F69"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.actionPillContent,
              compact && styles.actionPillContentCompact,
            ]}
          >
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}
              style={[
                styles.actionPillText,
                compact && styles.actionPillTextCompact,
              ]}
            >
              客服派单
            </Text>
          </LinearGradient>
        </Pressable>
      ) : null}
      {showSelectCompanion ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={selectCompanionLabel}
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
              {selectCompanionLabel}
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
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  composerCompact: { paddingHorizontal: 8 },
  composerPlaceholder: {
    color: "#979799",
    fontSize: 14,
    lineHeight: 22,
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
  actionPillButton: { flexShrink: 0, borderRadius: 18 },
  actionPillContent: {
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  actionPillContentCompact: { paddingHorizontal: 8 },
  actionPillText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  actionPillTextCompact: { fontSize: 12 },
  /** Figma 542:121702：接待派单 pill（图标 22 + 文案，pl8/pr12/gap4） */
  dispatchButton: { flexShrink: 0, borderRadius: 18, overflow: "hidden" },
  dispatchContent: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: 18,
    overflow: "hidden",
  },
  dispatchContentCompact: { paddingRight: 8 },
  dispatchIcon: { width: 22, height: 22 },
  dispatchText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  dispatchTextCompact: { fontSize: 12 },
  dispatchCallingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 18,
  },
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
