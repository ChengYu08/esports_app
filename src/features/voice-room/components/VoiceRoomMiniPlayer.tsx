import { useAuthStore } from '@esports/auth';
import { Dismiss24Regular, PeopleCommunity24Regular } from '@fluentui/react-native-icons';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { voiceRoomApi } from '../voice-room.api';
import { leaveVoiceRtc } from '../voice-room-rtc';
import { leaveVoiceChatRoom } from '../voice-room-rongcloud';
import { useVoiceRoomSessionStore } from '../voice-room-session';

export function VoiceRoomMiniPlayer() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const room = useVoiceRoomSessionStore((state) => state.activeRoom);
  const clearActiveRoom = useVoiceRoomSessionStore((state) => state.clearActiveRoom);
  const [leaving, setLeaving] = useState(false);

  if (!room || pathname.startsWith('/voice-room/')) return null;

  const openRoom = () => router.push({
    pathname: '/voice-room/[id]',
    params: { id: room.roomId, v: room.roomVersion },
  });

  const confirmLeave = () => {
    if (leaving) return;
    const isOwner = String(user?.id ?? '') === room.creatorUserId;
    Alert.alert(
      isOwner ? '解散语聊房' : '离开语聊房',
      isOwner ? '解散后，房间内的成员都会退出。确定解散吗？' : '确定离开当前语聊房吗？',
      [
        { text: '取消', style: 'cancel' },
        { text: isOwner ? '解散' : '离开', style: 'destructive', onPress: () => void leaveRoom() },
      ],
    );
  };

  const leaveRoom = async () => {
    if (!accessToken || leaving) return;
    setLeaving(true);
    try {
      if (String(user?.id ?? '') === room.creatorUserId) {
        await voiceRoomApi.destroy(room.roomId, room.roomVersion, accessToken);
      } else {
        await voiceRoomApi.leave(room.roomId, room.roomVersion, accessToken);
      }
      await leaveVoiceRtc();
      await leaveVoiceChatRoom(room.rongChatroomId);
      clearActiveRoom(room.roomId);
    } catch (error) {
      Alert.alert('操作失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setLeaving(false);
    }
  };

  return (
    <View style={[styles.position, { bottom: insets.bottom + 82 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="返回语聊房" onPress={openRoom} style={styles.roomButton}>
        {room.ownerAvatar
          ? <Image source={{ uri: room.ownerAvatar }} contentFit="cover" style={styles.avatar} />
          : <View style={styles.avatarFallback}><PeopleCommunity24Regular color="#FFFFFF" width={20} height={20} /></View>}
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>{room.roomName || '语聊房'}</Text>
          <Text style={styles.subtitle}>语聊房进行中 · 点击返回</Text>
        </View>
        <View style={styles.liveDot} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="离开语聊房" disabled={leaving} onPress={confirmLeave} style={styles.leaveButton}>
        <Dismiss24Regular color="#D42D42" width={20} height={20} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  position: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    gap: 8,
  },
  roomButton: {
    flex: 1,
    minWidth: 0,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEEEEE' },
  avatarFallback: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FE1F4C' },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: '#202124', fontSize: 13, fontWeight: '600' },
  subtitle: { color: '#73777D', fontSize: 11 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#30B36B' },
  leaveButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
