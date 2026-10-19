import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

const microphoneIcon = require('../../../../assets/voice-room/toolbar-mic.svg');

// Keep the open/muted silhouettes aligned with pzdj-pc/components/icons/MicIcon.vue.
function MicrophoneIcon({ muted, color, size }: { muted: boolean; color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
      {muted ? (
        <>
          <Line x1={2} x2={22} y1={2} y2={22} />
          <Path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
          <Path d="M5 10v2a7 7 0 0 0 12 5" />
          <Path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
          <Path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
        </>
      ) : (
        <>
          <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        </>
      )}
      <Line x1={12} x2={12} y1={19} y2={22} />
    </Svg>
  );
}

type MicControlProps = {
  muted: boolean;
  ready: boolean;
  connecting: boolean;
  pending: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function VoiceRoomMicControl({ muted, ready, connecting, pending, disabled = false, onPress }: MicControlProps) {
  const busy = pending || (!ready && connecting);
  const unavailable = !ready || disabled || busy;
  const color = !ready ? '#9296AA' : muted ? '#FF6D8C' : '#F4F5FF';
  const label = pending ? '切换中' : !ready ? (connecting ? '连接中' : '未连接') : muted ? '已闭麦' : '已开麦';

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={`麦克风，${label}`}
      accessibilityHint={ready ? (muted ? '点击打开麦克风' : '点击关闭麦克风') : '语音连接就绪后可开麦'}
      accessibilityState={{ checked: ready && !muted, disabled: unavailable, busy }}
      aria-checked={ready && !muted}
      aria-busy={busy}
      aria-disabled={unavailable}
      disabled={unavailable}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.control, ready && muted && styles.controlMuted, disabled && styles.disabled, pressed && styles.pressed]}
    >
      {busy ? <ActivityIndicator size="small" color={color} style={styles.controlIcon} /> : ready && !muted ? (
        <Image source={microphoneIcon} style={styles.controlIcon} contentFit="contain" />
      ) : (
        <MicrophoneIcon muted={!ready || muted} color={color} size={20} />
      )}
    </Pressable>
  );
}

export function VoiceRoomMicBadge({ muted, speaking = false }: { muted: boolean; speaking?: boolean }) {
  return (
    <View pointerEvents="none" style={[styles.badge, !muted && styles.badgeOpen, !muted && speaking && styles.badgeSpeaking]}>
      <MicrophoneIcon muted={muted} color={muted ? '#A3A2B5' : '#FFFFFF'} size={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  control: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', flexShrink: 0 },
  controlMuted: { backgroundColor: 'rgba(254,31,76,0.14)' },
  controlIcon: { width: 20, height: 20 },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.8 },
  badge: { position: 'absolute', right: -1, bottom: -1, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#11102F', backgroundColor: '#28273F', alignItems: 'center', justifyContent: 'center' },
  badgeOpen: { backgroundColor: '#44415F' },
  badgeSpeaking: { backgroundColor: '#0C7A3F' },
});
