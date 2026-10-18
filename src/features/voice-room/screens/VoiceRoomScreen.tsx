import { useAuthStore } from '@esports/auth';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import Toast from 'react-native-root-toast';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { voiceRoomApi } from '../voice-room.api';
import { joinVoiceRtc, leaveVoiceRtc, muteVoiceRtc } from '../voice-room-rtc';
import {
  joinVoiceChatRoom,
  leaveVoiceChatRoom,
  sendVoiceChatMessage,
  subscribeVoiceChatMembers,
  subscribeVoiceChatMessages,
} from '../voice-room-rongcloud';
import type { VoiceRoomDetail, VoiceRoomMember, VoiceRoomMessage } from '../voice-room.types';

const background = require('../../../../assets/voice-room/background.svg');
const backIcon = require('../../../../assets/voice-room/back.svg');
const closeIcon = require('../../../../assets/voice-room/close.svg');
const inviteIcon = require('../../../../assets/voice-room/invite.svg');
const audioIcon = require('../../../../assets/voice-room/audio.svg');
const messageIcon = require('../../../../assets/voice-room/message.svg');
const micIcon = require('../../../../assets/voice-room/mic.svg');
const defaultAvatar = require('../../../../assets/voice-room/avatar-default.png');
const ringOwner = require('../../../../assets/voice-room/ring-owner.svg');
const ringInvite = require('../../../../assets/voice-room/ring-invite.svg');

const inviteMember: VoiceRoomMember = {
  userId: 'invite',
  nickname: '邀请用户',
  role: 'guest',
};

function avatarSource(member: VoiceRoomMember) {
  if (member.avatar?.startsWith('http')) return { uri: member.avatar };
  return defaultAvatar;
}

function normalizeMembers(detail: VoiceRoomDetail | undefined, currentUser?: { id: string; nickname?: string; headImage?: string }) {
  const currentUserId = currentUser?.id;
  const self = currentUser ? [{
    userId: currentUser.id,
    nickname: currentUser.nickname || '我',
    avatar: currentUser.headImage,
    role: String(detail?.creatorUserId ?? '') === currentUser.id ? 'owner' as const : undefined,
  }] : [];
  const people = (detail?.members || []).filter((member) => member.userId !== currentUserId && member.userId !== 'invite');
  return [...self, ...people].slice(0, 7).concat(inviteMember);
}

function displayMessage(message: VoiceRoomMessage) {
  if (message.kind === 'notice') return <Text style={styles.noticeText}>{message.text}</Text>;
  return (
    <View style={styles.messageRow}>
      <Text style={styles.messageName}>{message.nickname || '用户'}</Text>
      <Text style={styles.messageBody}>{message.text}</Text>
    </View>
  );
}

export default function VoiceRoomScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.user);
  const roomId = typeof id === 'string' ? id : id?.[0];
  const [room, setRoom] = useState<VoiceRoomDetail | null>(null);
  const [members, setMembers] = useState<VoiceRoomMember[]>(() => normalizeMembers(undefined, currentUser || undefined));
  const [messages, setMessages] = useState<VoiceRoomMessage[]>([
    { id: 'welcome', kind: 'notice', text: '欢迎来到语聊房，和大家一起开黑吧', sentAt: 1 },
    { id: 'tips', kind: 'system', text: '房间内请文明交流，友善互动', sentAt: 2 },
  ]);
  const [input, setInput] = useState('');
  const [muted, setMuted] = useState(false);
  const [serviceCalling, setServiceCalling] = useState(false);
  const [loading, setLoading] = useState(() => Boolean(roomId && accessToken));
  const [error, setError] = useState<string | null>(() => (
    !roomId ? '语聊房不存在' : !accessToken ? '请先登录后进入语聊房' : null
  ));

  const roomVersion = room?.roomVersion ?? '1';
  const chatroomId = room?.rongChatroomId;
  const roomTitle = room?.roomName || '语聊房';
  useEffect(() => {
    if (!roomId || !accessToken) {
      return;
    }
    let active = true;
    let joinedChatroom: string | undefined;
    void (async () => {
      try {
        const detail = await voiceRoomApi.getDetail(roomId, accessToken);
        if (!active) return;
        const prepared = await voiceRoomApi.prepareJoin(roomId, detail.roomVersion ?? '1', accessToken);
        if (!active) return;
        setRoom({ ...detail, ...prepared, roomId });
        setMembers(normalizeMembers({ ...detail, ...prepared }, currentUser || undefined));
        joinedChatroom = prepared.rongChatroomId;
        await joinVoiceChatRoom(accessToken, prepared.rongChatroomId);
        const rtc = await voiceRoomApi.getRtcToken(roomId, prepared.roomVersion, accessToken);
        if (rtc.accessStatus && rtc.accessStatus !== 'READY') throw new Error('语聊房当前不可加入');
        const token = rtc.token || rtc.rtcToken;
        const channelName = rtc.channelName || rtc.rtcChannelName || prepared.rtcChannelName;
        if (token && channelName) {
          await joinVoiceRtc({
            appId: rtc.appId,
            token,
            channelName,
            uid: Number(rtc.uid || rtc.agoraUid || currentUser?.id || 0),
            callbacks: {
              onUserJoined: (uid) => setMembers((items) => items.map((item) => item.userId === uid ? { ...item, micOpen: true } : item)),
              onUserOffline: (uid) => setMembers((items) => items.map((item) => item.userId === uid ? { ...item, micOpen: false, speaking: false } : item)),
              onUserMuted: (uid, value) => setMembers((items) => items.map((item) => item.userId === uid ? { ...item, micOpen: !value } : item)),
              onSpeakingChanged: (uids) => setMembers((items) => items.map((item) => ({ ...item, speaking: uids.includes(item.userId) }))),
            },
          });
        }
        setError(null);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : '进入语聊房失败');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      void leaveVoiceRtc();
      if (joinedChatroom) void leaveVoiceChatRoom(joinedChatroom);
    };
  }, [accessToken, currentUser, roomId]);

  useEffect(() => {
    if (!chatroomId) return;
    const stopMessages = subscribeVoiceChatMessages((message) => {
      if (message.id === 'welcome') return;
      setMessages((items) => [...items, { ...message, kind: 'chat' as const }].slice(-80));
    });
    const stopMembers = subscribeVoiceChatMembers((targetId, actions) => {
      if (targetId !== chatroomId) return;
      setMembers((items) => actions.reduce<VoiceRoomMember[]>((next, action) => {
        const userId = action.userId;
        if (!userId || userId === 'invite' || userId === currentUser?.id) return next;
        if (action.actionType === 2) return next.filter((member) => member.userId !== userId);
        if (action.actionType === 1 && !next.some((member) => member.userId === userId)) {
          return [...next.filter((member) => member.userId !== 'invite'), {
            userId,
            nickname: `用户${userId}`,
            role: String(room?.creatorUserId ?? '') === userId ? 'owner' as const : undefined,
          }, inviteMember].slice(0, 8);
        }
        return next;
      }, items));
    });
    return () => {
      stopMessages();
      stopMembers();
    };
  }, [chatroomId, currentUser?.id, room?.creatorUserId]);

  const leave = async () => {
    if (roomId && accessToken) await voiceRoomApi.leave(roomId, roomVersion, accessToken).catch(() => undefined);
    router.back();
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    const local = { id: `local-${Date.now()}`, nickname: currentUser?.nickname || '我', text, sentAt: Date.now(), kind: 'chat' as const };
    setMessages((items) => [...items, local].slice(-80));
    if (chatroomId) await sendVoiceChatMessage(chatroomId, text).catch(() => Alert.alert('发送失败', '请稍后重试'));
  };

  const toggleMute = () => {
    const next = !muted;
    muteVoiceRtc(next);
    setMuted(next);
    setMembers((items) => items.map((item) => item.userId === currentUser?.id ? { ...item, micOpen: !next } : item));
  };

  const callService = async () => {
    if (!roomId || !accessToken || serviceCalling) return;
    if (!room?.clubId) {
      Alert.alert('客服派单', '当前房间暂未绑定俱乐部客服。');
      return;
    }
    setServiceCalling(true);
    try {
      await voiceRoomApi.inviteClubService(roomId, roomVersion, room.clubId, accessToken);
      Alert.alert('客服派单', '已呼叫俱乐部接待，请稍候。');
    } catch (cause) {
      Alert.alert('客服派单失败', cause instanceof Error ? cause.message : '请稍后重试');
    } finally {
      setServiceCalling(false);
    }
  };

  const copyInviteLink = async () => {
    if (!roomId || !room) {
      Toast.show('房间信息加载中，请稍后再试', { duration: Toast.durations.SHORT });
      return;
    }
    const inviteLink = `https://djpc.jlgkj.top/chat?type=chat-room&id=${encodeURIComponent(roomId)}&v=${encodeURIComponent(String(room.roomVersion ?? '1'))}`;
    try {
      await Clipboard.setStringAsync(inviteLink);
      Toast.show('邀请链接已复制，去发给好友吧', { duration: Toast.durations.SHORT });
    } catch {
      Toast.show('复制失败，请手动复制', { duration: Toast.durations.SHORT });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <Image source={background} contentFit="cover" style={StyleSheet.absoluteFill} />
      <View style={[styles.safe, { paddingTop: insets.top }]}> 
        <View style={styles.header}>
          <Pressable accessibilityLabel="返回" onPress={() => void leave()} hitSlop={12} style={styles.headerButton}>
            <Image source={backIcon} style={styles.headerIcon} />
          </Pressable>
          <Text style={styles.title}>{roomTitle}</Text>
          <Pressable accessibilityLabel="关闭语聊房" onPress={() => void leave()} hitSlop={12} style={styles.headerButton}>
            <Image source={closeIcon} style={styles.headerIcon} />
          </Pressable>
        </View>

        <View style={styles.roomMeta}>
          <Text style={styles.roomName}>{room?.roomName || '陪玩开黑语音房'}</Text>
          <Text style={styles.roomId}>房间号 {roomId || '--'}</Text>
        </View>

        <View style={styles.grid}>
          {members.map((member, index) => {
            const invite = member.userId === 'invite';
            const ring = invite ? ringInvite : member.role === 'owner' ? ringOwner : undefined;
            return (
              <Pressable key={`${member.userId}-${index}`} style={styles.memberSlot} onPress={invite ? () => void copyInviteLink() : undefined}>
                <View style={[styles.avatarWrap, member.speaking && styles.avatarSpeaking]}>
                  {ring ? <Image source={ring} style={styles.ring} /> : null}
                  {invite ? <Image source={ringInvite} style={styles.inviteRing} /> : <Image source={avatarSource(member)} style={styles.avatar} />}
                  {!invite && member.micOpen ? <Image source={micIcon} style={styles.mic} /> : null}
                  {invite ? <Image source={inviteIcon} style={styles.inviteBadge} /> : null}
                </View>
                <Text numberOfLines={1} style={[styles.memberName, invite && styles.inviteName]}>{invite ? '邀请用户' : member.nickname}</Text>
                {member.role === 'owner' ? <Text style={styles.roleLabel}>房主</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.chatPanel}>
          {loading ? <ActivityIndicator color="#B8C5FF" style={styles.loading} /> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => displayMessage(item)}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
          />
        </View>

        <View style={[styles.composerArea, { paddingBottom: Math.max(insets.bottom, 12) }]}> 
          <View style={styles.composerRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => void sendMessage()}
              returnKeyType="send"
              placeholder="聊聊"
              placeholderTextColor="#7E819A"
              style={styles.input}
            />
            <Pressable accessibilityLabel={muted ? '打开麦克风' : '关闭麦克风'} onPress={toggleMute} style={styles.toolButton}>
              <Image source={audioIcon} style={[styles.toolIcon, muted && styles.toolIconMuted]} />
            </Pressable>
            <Pressable accessibilityLabel="发送消息" onPress={() => void sendMessage()} style={styles.toolButton}>
              <Image source={messageIcon} style={styles.toolIcon} />
            </Pressable>
            <Pressable accessibilityLabel="复制邀请链接" onPress={() => void copyInviteLink()} style={styles.toolButton}>
              <Image source={inviteIcon} style={styles.toolIcon} />
            </Pressable>
          </View>
          <Pressable accessibilityLabel="客服派单" style={[styles.serviceButton, serviceCalling && styles.serviceButtonDisabled]} onPress={() => void callService()} disabled={serviceCalling}>
            <Text style={styles.serviceText}>{serviceCalling ? '呼叫中...' : '客服派单'}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080B25' },
  safe: { flex: 1 },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { width: 22, height: 22 },
  title: { color: '#F6F7FF', fontSize: 17, fontWeight: '700' },
  roomMeta: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 12 },
  roomName: { color: '#F7F8FF', fontSize: 16, fontWeight: '700' },
  roomId: { color: '#9296B3', fontSize: 11, marginTop: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, rowGap: 16 },
  memberSlot: { width: '25%', alignItems: 'center', minHeight: 96 },
  avatarWrap: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29 },
  avatarSpeaking: { shadowColor: '#9D77FF', shadowOpacity: 0.95, shadowRadius: 9, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  ring: { position: 'absolute', width: 58, height: 58 },
  inviteRing: { position: 'absolute', width: 58, height: 58 },
  mic: { position: 'absolute', right: 0, bottom: 0, width: 17, height: 17 },
  inviteBadge: { width: 22, height: 22 },
  memberName: { color: '#F0F1FF', fontSize: 11, maxWidth: 76, marginTop: 7, textAlign: 'center' },
  inviteName: { color: '#A9B2E9' },
  roleLabel: { color: '#D3A2FF', fontSize: 9, marginTop: 2 },
  chatPanel: { flex: 1, marginTop: 8, marginHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(193, 198, 255, 0.16)' },
  loading: { marginTop: 12 },
  errorText: { color: '#FFB1B6', fontSize: 12, paddingTop: 10, paddingHorizontal: 4 },
  messageList: { paddingTop: 12, paddingBottom: 10 },
  noticeText: { color: '#9EA7D1', fontSize: 12, lineHeight: 20, marginBottom: 8 },
  messageRow: { flexDirection: 'row', marginBottom: 8, paddingRight: 12 },
  messageName: { color: '#B892FF', fontSize: 12, marginRight: 6 },
  messageBody: { color: '#E9EAF5', fontSize: 12, flex: 1, lineHeight: 18 },
  composerArea: { paddingHorizontal: 16, paddingTop: 8, backgroundColor: 'rgba(8, 10, 32, 0.78)' },
  composerRow: { height: 44, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(44, 46, 86, 0.74)', borderRadius: 22, paddingLeft: 16, paddingRight: 5 },
  input: { flex: 1, color: '#F4F5FF', fontSize: 13, paddingVertical: 0 },
  toolButton: { width: 32, height: 34, alignItems: 'center', justifyContent: 'center' },
  toolIcon: { width: 21, height: 21 },
  toolIconMuted: { opacity: 0.45 },
  serviceButton: { height: 40, marginTop: 10, borderRadius: 20, backgroundColor: '#F04455', alignItems: 'center', justifyContent: 'center' },
  serviceButtonDisabled: { opacity: 0.62 },
  serviceText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});

