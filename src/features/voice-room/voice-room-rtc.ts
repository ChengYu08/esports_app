import { Platform } from 'react-native';
import type { IRtcEngine, IRtcEngineEventHandler } from 'react-native-agora';

import { env } from '@/core/config/env';

export type VoiceRtcCallbacks = {
  onUserJoined?: (uid: string) => void;
  onUserOffline?: (uid: string) => void;
  onUserMuted?: (uid: string, muted: boolean) => void;
  onSpeakingChanged?: (uids: string[]) => void;
};

let engine: IRtcEngine | null = null;
let handler: IRtcEngineEventHandler | null = null;

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
  if (!engine) engine = agora.createAgoraRtcEngine();
  engine.initialize({ appId });
  engine.setChannelProfile(agora.ChannelProfileType.ChannelProfileCommunication);
  engine.enableAudio();
  handler = {
    onUserJoined: (_connection, uid) => options.callbacks?.onUserJoined?.(String(uid)),
    onUserOffline: (_connection, uid) => options.callbacks?.onUserOffline?.(String(uid)),
    onUserMuteAudio: (_connection, uid, muted) => options.callbacks?.onUserMuted?.(String(uid), muted),
    onAudioVolumeIndication: (_connection, speakers) => {
      options.callbacks?.onSpeakingChanged?.(
        speakers.filter((speaker) => (speaker.volume ?? 0) > 20).map((speaker) => String(speaker.uid)),
      );
    },
  };
  engine.registerEventHandler(handler);
  engine.enableAudioVolumeIndication(200, 3, true);
  const result = engine.joinChannel(options.token, options.channelName, options.uid, {
    autoSubscribeAudio: true,
    publishMicrophoneTrack: true,
    clientRoleType: agora.ClientRoleType.ClientRoleBroadcaster,
  });
  if (result !== 0) throw new Error(`声网进房失败（${result}）`);
  return true;
}

export function muteVoiceRtc(muted: boolean) {
  return engine?.muteLocalAudioStream(muted) ?? 0;
}

export async function leaveVoiceRtc() {
  if (!engine) return;
  try {
    if (handler) engine.unregisterEventHandler(handler);
    engine.leaveChannel();
    engine.release();
  } finally {
    handler = null;
    engine = null;
  }
}

