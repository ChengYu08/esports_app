import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { clamp, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VoiceWaveform } from '@/shared/audio/VoiceWaveform';
import { navigateToVoiceRoom } from '../navigate-voice-room';
import { useVoiceRoomSessionStore } from '../voice-room-session';

const fallbackAvatar = require('../../../../assets/voice-room/floating-avatar.png');
const recordingIcon = require('../../../../assets/voice-room/floating-recording.svg');
const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 48;
const DRAG_THRESHOLD = 6;
/**
 * Figma 2364:96434 / 812 画布：MiniPlayer 底边 y=608 → 距屏幕底 204。
 * 与 FAB 距底 128 错开，切 Tab 固定不跳动。
 */
const FIGMA_PLAYER_BOTTOM_FROM_SCREEN = 204;

/** Figma 102.85° 底层蓝渐变 */
const BLUE_GRADIENT = {
  colors: ['#1F31FF', '#1FBCFF'] as const,
  locations: [0.091369, 0.93383] as const,
  start: { x: 0.013, y: 0.389 },
  end: { x: 0.987, y: 0.611 },
};

/** Figma 257.84° 上层深蓝紫渐变 */
const NAVY_GRADIENT = {
  colors: ['#0C0C2E', '#2F2759'] as const,
  locations: [0.007869, 0.67447] as const,
  start: { x: 0.989, y: 0.396 },
  end: { x: 0.011, y: 0.604 },
};

export function VoiceRoomMiniPlayer() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const room = useVoiceRoomSessionStore((state) => state.activeRoom);
  const microphoneMuted = useVoiceRoomSessionStore((state) => state.microphoneMuted);
  // Keep offsets mounted while the room screen is open so minimizing restores the position.
  const offsetY = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const defaultY = Math.max(
    insets.top,
    height - FIGMA_PLAYER_BOTTOM_FROM_SCREEN - PLAYER_HEIGHT,
  );
  const minY = insets.top - defaultY;
  const maxY = Math.max(0, height - insets.bottom - PLAYER_HEIGHT - defaultY);

  const openRoom = useCallback(() => {
    if (!room) return;
    // 选人页是房内临时页：直接 back 回到压在下面的语聊房实例，不叠层
    if (pathname.startsWith('/match/matching') && router.canGoBack()) {
      router.back();
      return;
    }
    // 单实例导航：房内切房原地换 params，其他页面进入 push 保留中间路由
    navigateToVoiceRoom({
      id: room.roomId,
      v: room.roomVersion,
      // 试音场景靠路由回填；quickMatchCreated 仅依赖 session，进房后由 VoiceRoomScreen 读 session
      ...(room.scene === 'audition' && room.matchRequestNo
        ? {
            scene: 'audition',
            requestNo: room.matchRequestNo,
            ...(room.matchExpireTime
              ? { expireTime: room.matchExpireTime }
              : {}),
            ...(room.matchGameId && room.matchGameName
              ? {
                  gameId: room.matchGameId,
                  gameName: room.matchGameName,
                  ...(room.matchGameIconUrl
                    ? { gameIconUrl: room.matchGameIconUrl }
                    : {}),
                }
              : {}),
          }
        : {}),
    });
  }, [pathname, room]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(DRAG_THRESHOLD)
      .maxPointers(1)
      .onStart(() => {
        dragStartY.set(clamp(offsetY.get(), minY, maxY));
      })
      .onUpdate((event) => {
        offsetY.set(clamp(dragStartY.get() + event.translationY, minY, maxY));
      });
    const tap = Gesture.Tap()
      .maxDistance(DRAG_THRESHOLD)
      .runOnJS(true)
      .onEnd((_event, success) => {
        if (success) openRoom();
      });

    return Gesture.Race(pan, tap);
  }, [dragStartY, maxY, minY, offsetY, openRoom]);

  const positionStyle = useAnimatedStyle(() => {
    return {
      right: insets.right,
      transform: [{ translateY: defaultY + clamp(offsetY.get(), minY, maxY) }],
    };
  });

  if (!room || pathname.startsWith('/voice-room/')) return null;

  const avatar = room.ownerAvatar?.trim();

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`返回${room.roomName || '语聊房'}`}
          accessibilityHint="语音连接保持中，点击展开房间，可沿右侧上下拖动"
          accessibilityValue={{ text: microphoneMuted ? '麦克风已关闭' : '麦克风已开启' }}
          accessibilityActions={[{ name: 'activate', label: '展开房间' }]}
          onAccessibilityTap={openRoom}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'activate') openRoom();
          }}
          style={[styles.position, positionStyle]}
        >
          <View style={styles.shell}>
            <LinearGradient
              colors={[...BLUE_GRADIENT.colors]}
              locations={[...BLUE_GRADIENT.locations]}
              start={BLUE_GRADIENT.start}
              end={BLUE_GRADIENT.end}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={[...NAVY_GRADIENT.colors]}
              locations={[...NAVY_GRADIENT.locations]}
              start={NAVY_GRADIENT.start}
              end={NAVY_GRADIENT.end}
              style={styles.background}
            >
              <View style={styles.avatarWrap}>
                <Image
                  source={avatar ? { uri: avatar.startsWith('//') ? `https:${avatar}` : avatar } : fallbackAvatar}
                  contentFit="cover"
                  style={styles.avatar}
                />
                <View style={styles.avatarOverlay} />
                {microphoneMuted ? (
                  <Image source={recordingIcon} contentFit="contain" style={styles.recordingIcon} />
                ) : (
                  <VoiceWaveform playing />
                )}
              </View>
            </LinearGradient>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 100 },
  position: {
    position: 'absolute',
    top: 0,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    shadowColor: '#0C0C2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  shell: {
    flex: 1,
    borderTopLeftRadius: 100,
    borderBottomLeftRadius: 100,
    overflow: 'hidden',
  },
  background: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 6,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { ...StyleSheet.absoluteFill },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  recordingIcon: { width: 18, height: 18 },
});
