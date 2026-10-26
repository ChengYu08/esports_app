import { useAuthStore } from '@esports/auth';
import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfileDetail } from '@/features/mine/hooks/use-profile-data';
import { useToggleUserFollow, useUserFollowState } from '@/features/mine/hooks/use-user-follow';
import { useAppConfirm } from '@/shared/ui/app-confirm';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { canKickVoiceRoomMember, getMemberAge } from '../member-profile';
import { voiceRoomApi } from '../voice-room.api';
import type { VoiceRoomDetail, VoiceRoomMember } from '../voice-room.types';

const defaultAvatar = require('../../../../assets/coms/avatar_default.webp');
const femaleIcon = require('../../../../assets/voice-room/member-female.svg');
const maleIcon = require('../../../../assets/home/club-detail/male.svg');
const idIcon = require('../../../../assets/voice-room/member-id.svg');
const closeIcon = require('../../../../assets/voice-room/member-close.svg');

type Props = {
  visible: boolean;
  member: VoiceRoomMember | null;
  room: VoiceRoomDetail | null;
  roomId?: string;
  onClose: () => void;
  onMemberKicked: (userId: string) => void;
};

export function VoiceRoomMemberSheet({ visible, member, room, roomId, onClose, onMemberKicked }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const token = useAuthStore((state) => state.accessToken);
  const viewer = useAuthStore((state) => state.user);
  const viewerId = viewer?.id == null ? undefined : String(viewer.id);
  const isSelf = member?.userId === viewerId;
  const profileQuery = useProfileDetail(member ? { userId: member.userId } : null);
  const followQuery = useUserFollowState(isSelf ? undefined : member?.userId);
  const toggleFollow = useToggleUserFollow();
  const kickMember = useMutation({
    mutationFn: (params: { roomId: string; roomVersion: string | number; userId: string; token: string }) =>
      voiceRoomApi.kickMember(params.roomId, params.roomVersion, params.userId, params.token),
    onSuccess: (_, params) => onMemberKicked(params.userId),
    onError: (error) => {
      void useAppConfirm.getState().confirm({
        title: '踢出失败',
        message: error.message || '请稍后重试',
      });
    },
  });

  if (!member) return null;

  const profile = profileQuery.data;
  const nickname = profile?.nickname || member.nickname;
  const avatar = (profile?.headImage || member.avatar)?.trim();
  const avatarSource = avatar ? { uri: avatar.startsWith('//') ? `https:${avatar}` : avatar } : defaultAvatar;
  const gender = profile?.sex ?? (isSelf ? viewer?.gender : undefined);
  const age = getMemberAge(profile?.birth);
  const signature = profile?.signature || (isSelf ? viewer?.signature : '') || '这个人很神秘，还没有填写简介';
  const canKick = Boolean(roomId && token) && canKickVoiceRoomMember(room, viewerId, member.userId);
  const followed = Boolean(followQuery.data?.followed);
  const busy = kickMember.isPending || toggleFollow.isPending;

  function confirmKick() {
    if (!canKick || !member || !room || !roomId || !token || busy) return;
    const params = { roomId, roomVersion: room.roomVersion, userId: member.userId, token };
    void (async () => {
      const confirmed = await useAppConfirm.getState().confirm({
        title: '踢出用户',
        message: `确定将“${nickname}”踢出语聊房？`,
        cancelText: '取消',
        confirmText: '踢出',
      });
      if (confirmed) kickMember.mutate(params);
    })();
  }

  async function handleFollow() {
    if (!member || !token || !viewerId || isSelf || busy) return;
    if (!followQuery.data) {
      void followQuery.refetch();
      return;
    }
    try {
      await toggleFollow.mutateAsync({
        followUserId: member.userId,
        currentlyFollowed: followed,
        token,
        viewerUserId: viewerId,
      });
    } catch (error) {
      void useAppConfirm.getState().confirm({
        title: '操作失败',
        message: error instanceof Error ? error.message : '请稍后重试',
      });
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} contentStyle={styles.sheet} backdropStyle={styles.backdrop}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: height - insets.top - 24 }}>
        <View style={styles.header}>
          <LinearGradient
            colors={['#FFEFF0', '#F5F4FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.17 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(255,255,255,0)', '#FFFFFF']}
            locations={[0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.avatarShadow}>
            <Image source={avatarSource} contentFit="cover" style={styles.avatar} accessibilityLabel={`${nickname}的头像`} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭用户资料" onPress={onClose} hitSlop={8} style={styles.close}>
            <Image source={closeIcon} style={styles.closeIcon} />
          </Pressable>
        </View>

        <View style={[styles.body, { paddingBottom: insets.bottom + 16 }]}>
          <Text numberOfLines={2} style={styles.nickname}>{nickname}</Text>
          <View style={styles.meta}>
            {gender === 1 || gender === 2 || age ? (
              <View style={styles.metaItem}>
                {gender === 1 || gender === 2 ? <Image source={gender === 2 ? femaleIcon : maleIcon} style={styles.genderIcon} /> : null}
                {age ? <Text style={[styles.age, gender === 2 && styles.femaleAge]}>{age}</Text> : null}
              </View>
            ) : null}
            <View style={styles.metaItem} accessibilityLabel={`用户 ID ${member.userId}`}>
              <Image source={idIcon} style={styles.idIcon} />
              <Text selectable style={styles.userId}>{member.userId}</Text>
            </View>
          </View>
          <Pressable
            disabled={!profileQuery.isError}
            accessibilityRole={profileQuery.isError ? 'button' : undefined}
            onPress={() => void profileQuery.refetch()}
            style={styles.signatureArea}
          >
            <Text style={styles.signature}>
              {profileQuery.isPending ? '资料加载中…' : profileQuery.isError && !profile ? '资料加载失败，点击重试' : signature}
            </Text>
          </Pressable>

          <View style={styles.actions}>
            {canKick ? (
              <Pressable accessibilityRole="button" accessibilityLabel="踢出用户" disabled={busy} onPress={confirmKick} style={[styles.button, busy && styles.disabled]}>
                {kickMember.isPending ? <ActivityIndicator color="#FE1F4C" /> : <Text style={[styles.buttonText, styles.kickText]}>踢出</Text>}
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看用户主页"
              disabled={busy}
              onPress={() => {
                onClose();
                router.push({ pathname: '/profile', params: { userId: member.userId } });
              }}
              style={[styles.button, busy && styles.disabled]}
            >
              <Text style={styles.buttonText}>主页</Text>
            </Pressable>
            {!isSelf ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={followed ? '取消关注' : '关注用户'}
                disabled={!token || busy || followQuery.isFetching}
                onPress={() => void handleFollow()}
                style={[styles.button, styles.followButton, followed && styles.followedButton, (!token || busy || followQuery.isFetching) && styles.disabled]}
              >
                {toggleFollow.isPending || followQuery.isFetching ? <ActivityIndicator color={followed ? '#808080' : '#FFFFFF'} /> : (
                  <Text style={[styles.buttonText, styles.followText, followed && styles.followedText]}>
                    {followQuery.isError && !followQuery.data ? '重试' : followed ? '已关注' : '关注'}
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  backdrop: { backgroundColor: 'transparent' },
  header: { height: 160, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 24 },
  avatarShadow: { width: 88, height: 88, borderRadius: 44, borderWidth: 4, borderColor: '#FFFFFF', backgroundColor: '#ECEBEF', shadowColor: '#000000', shadowOffset: { width: -5, height: -3 }, shadowOpacity: 0.1, shadowRadius: 28, elevation: 5 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  close: { position: 'absolute', right: 13, top: 12 },
  closeIcon: { width: 28, height: 28 },
  body: { paddingHorizontal: 16, alignItems: 'center' },
  nickname: { color: '#161823', fontSize: 20, lineHeight: 28, fontWeight: '500', textAlign: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8, minHeight: 18 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  genderIcon: { width: 12, height: 12 },
  age: { color: '#808080', fontSize: 12, fontWeight: '500', lineHeight: 18 },
  femaleAge: { color: '#FF4D70' },
  idIcon: { width: 14, height: 14 },
  userId: { color: '#808080', fontSize: 12, lineHeight: 18 },
  signatureArea: { width: '100%', marginTop: 8, minHeight: 40, justifyContent: 'center' },
  signature: { color: 'rgba(22,24,35,0.6)', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 24 },
  button: { flex: 1, minHeight: 44, paddingVertical: 11, borderRadius: 8, backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#0A0A0A', fontSize: 15, lineHeight: 22, fontWeight: '500' },
  kickText: { color: '#FE1F4C' },
  followButton: { backgroundColor: '#FE1F4C' },
  followText: { color: '#FFFFFF' },
  followedButton: { backgroundColor: '#F2F2F2' },
  followedText: { color: '#808080' },
  disabled: { opacity: 0.55 },
});
