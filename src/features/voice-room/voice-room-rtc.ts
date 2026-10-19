import { Platform } from 'react-native';
import type { IRtcEngine, IRtcEngineEventHandler } from 'react-native-agora';

import { env } from '@/core/config/env';
import { startVoiceRoomBackground, stopVoiceRoomBackground } from './voice-room-background';

export type VoiceRtcCallbacks = {
  onUserJoined?: (uid: string) => void;
  onUserOffline?: (uid: string) => void;
  onUserMuted?: (uid: string, muted: boolean) => void;
  onSpeakingChanged?: (uids: string[]) => void;
};

let engine: IRtcEngine | null = null;
let handler: IRtcEngineEventHandler | null = null;
let activeChannelName: string | null = null;
let activeCallbacks: VoiceRtcCallbacks | undefined;
let localAudioMuted = true;
const remoteUserIds = new Set<string>();

function loadAgora(appId = env.agoraAppId) {
  if (Platform.OS === 'web' || !appId) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-agora') as typeof import('react-native-agora');
  } catch {
    return null;
  }
}

export function isVoiceRtcAvailable() {
  return Boolean(loadAgora());
}

export async function joinVoiceRtc(options: {
  appId?: string;
  token: string;
  channelName: string;
  uid: number;
  callbacks?: VoiceRtcCallbacks;
}) {
  const appId = options.appId || env.agoraAppId;
  const agora = loadAgora(appId);
  if (!agora) return false;
  if (engine && activeChannelName === options.channelName) {
    activeCallbacks = options.callbacks;
    return true;
  }
  if (engine) await leaveVoiceRtc();
  if (!engine) engine = agora.createAgoraRtcEngine();
  activeCallbacks = options.callbacks;
  localAudioMuted = true;
  engine.initialize({ appId });
  engine.setChannelProfile(agora.ChannelProfileType.ChannelProfileCommunication);
  engine.enableAudio();
  engine.setEnableSpeakerphone(true);
  handler = {
    onUserJoined: (_connection, uid) => {
      const userId = String(uid);
      remoteUserIds.add(userId);
      activeCallbacks?.onUserJoined?.(userId);
    },
    onUserOffline: (_connection, uid) => {
      const userId = String(uid);
      remoteUserIds.delete(userId);
      activeCallbacks?.onUserOffline?.(userId);
    },
    onUserMuteAudio: (_connection, uid, muted) => activeCallbacks?.onUserMuted?.(String(uid), muted),
    onAudioVolumeIndication: (_connection, speakers) => {
      activeCallbacks?.onSpeakingChanged?.(
        speakers.filter((speaker) => (speaker.volume ?? 0) > 20).map((speaker) => String(speaker.uid)),
      );
    },
  };
  engine.registerEventHandler(handler);
  engine.enableAudioVolumeIndication(200, 3, true);
  const result = engine.joinChannel(options.token, options.channelName, options.uid, {
    autoSubscribeAudio: true,
    publishMicrophoneTrack: false,
    clientRoleType: agora.ClientRoleType.ClientRoleBroadcaster,
  });
  if (result !== 0) throw new Error(`声网进房失败（${result}）`);
  activeChannelName = options.channelName;
  void startVoiceRoomBackground(false);
  return true;
}

export function getVoiceRtcRemoteUserIds() {
  return [...remoteUserIds];
}

export function clearVoiceRtcCallbacks() {
  activeCallbacks = undefined;
}

export function getVoiceRtcMuted() {
  return localAudioMuted;
}

export function muteVoiceRtc(muted: boolean) {
  if (!engine) return -1;
  const result = engine.updateChannelMediaOptions({
    autoSubscribeAudio: true,
    publishMicrophoneTrack: !muted,
  });
  if (result !== 0) return result;
  const muteResult = engine.muteLocalAudioStream(muted);
  if (muteResult === 0) {
    localAudioMuted = muted;
    void startVoiceRoomBackground(!muted);
  }
  return muteResult;
}

export async function leaveVoiceRtc() {
  if (!engine) return;
  try {
    if (handler) engine.unregisterEventHandler(handler);
    engine.leaveChannel();
    engine.release();
    void stopVoiceRoomBackground();
  } finally {
    handler = null;
    engine = null;
    activeChannelName = null;
    activeCallbacks = undefined;
    localAudioMuted = true;
    remoteUserIds.clear();
  }
}

