import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { clamp, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VoiceWaveform } from '@/shared/audio/VoiceWaveform';
import { useVoiceRoomSessionStore } from '../voice-room-session';

const fallbackAvatar = require('../../../../assets/voice-room/floating-avatar.png');
const recordingIcon = require('../../../../assets/voice-room/floating-recording.svg');
const PLAYER_WIDTH = 52;
const PLAYER_HEIGHT = 54;
const DRAG_THRESHOLD = 6;

export function VoiceRoomMiniPlayer() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const room = useVoiceRoomSessionStore((state) => state.activeRoom);
  const microphoneMuted = useVoiceRoomSessionStore((state) => state.microphoneMuted);
  // Keep offsets mounted while the room screen is open so minimizing restores the position.
  const offsetY = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const defaultY = Math.max(insets.top, height - insets.bottom - 126 - PLAYER_HEIGHT);
  const minY = insets.top - defaultY;
  const maxY = Math.max(0, height - insets.bottom - PLAYER_HEIGHT - defaultY);

  const openRoom = useCallback(() => {
    if (!room) return;
    // 选人页压在语聊房上时用 back，避免 navigate 再叠一层语聊房
    if (pathname.startsWith('/match/matching') && router.canGoBack()) {
      router.back();
      return;
    }
    router.navigate({
      pathname: '/voice-room/[id]',
      params: {
        id: room.roomId,
        v: room.roomVersion,
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
      },
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
          <LinearGradient
            colors={['#FF1F2E', '#FF1F69']}
            locations={[0.12117, 1]}
            start={{ x: 0, y: 0.4 }}
            end={{ x: 1, y: 0.6 }}
            style={styles.background}
          >
            <View pointerEvents="none" style={styles.highlight} />
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
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 100 },
  position: { position: 'absolute', top: 0, width: PLAYER_WIDTH, height: PLAYER_HEIGHT },
  background: { flex: 1, justifyContent: 'center', paddingHorizontal: 8, borderTopLeftRadius: 100, borderBottomLeftRadius: 100, overflow: 'hidden' },
  highlight: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.15)' },
  avatarWrap: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatar: { ...StyleSheet.absoluteFill },
  avatarOverlay: { ...StyleSheet.absoluteFill, borderRadius: 18, borderWidth: 0.9, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(0,0,0,0.5)' },
  recordingIcon: { width: 18, height: 18 },
});
