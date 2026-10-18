export type VoiceRoomMemberRole = 'owner' | 'service' | 'player' | 'guest';

export type VoiceRoomMember = {
  userId: string;
  nickname: string;
  avatar?: string;
  role?: VoiceRoomMemberRole;
  micOpen?: boolean;
  speaking?: boolean;
};

export type VoiceRoomMessage = {
  id: string;
  userId?: string;
  nickname?: string;
  avatar?: string;
  text: string;
  kind?: 'notice' | 'system' | 'chat';
  sentAt: number;
};

export type VoiceRoomDetail = {
  roomId: string;
  roomVersion: string | number;
  roomName?: string;
  roomStatus?: number;
  rongChatroomId?: string;
  rtcChannelName?: string;
  creatorUserId?: string | number;
  clubId?: string | number;
  serviceUserId?: string | number;
  members?: VoiceRoomMember[];
};

export type VoiceRoomJoinPrepare = VoiceRoomDetail & {
  rongChatroomId: string;
  roomVersion: string | number;
  rtcChannelName?: string;
};

export type VoiceRoomRtcToken = {
  accessStatus?: 'READY' | 'ROOM_CLOSED' | 'ROOM_VERSION_CHANGED' | 'NOT_IN_CHATROOM' | 'KICKED_BANNED' | string;
  appId?: string;
  token?: string;
  rtcToken?: string;
  channelName?: string;
  rtcChannelName?: string;
  uid?: string | number;
  agoraUid?: string | number;
};

