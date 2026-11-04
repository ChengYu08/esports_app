import { Platform } from 'react-native';
import type { IRtcEngine, IRtcEngineEventHandler } from 'react-native-agora';

import { env } from '@/core/config/env';
import { startVoiceRoomBackground, stopVoiceRoomBackground, updateVoiceRoomMicrophone } from './voice-room-background';
import { useVoiceRoomSessionStore } from './voice-room-session';

export type VoiceRtcCallbacks = {
  onUserJoined?: (uid: string) => void;
  onUserOffline?: (uid: string) => void;
  onUserMuted?: (uid: string, muted: boolean) => void;
  onRemoteAudioActive?: (uid: string) => void;
  onSpeakingChanged?: (uids: string[]) => void;
};

/** joinChannel 被拒：用户仍在频道内（须等 Disconnected 后再 join） */
const ERR_JOIN_CHANNEL_REJECTED = -17;
const LEAVE_DISCONNECT_TIMEOUT_MS = 3000;

let engine: IRtcEngine | null = null;
let handler: IRtcEngineEventHandler | null = null;
let activeChannelName: string | null = null;
let activeCallbacks: VoiceRtcCallbacks | undefined;
const remoteUserIds = new Set<string>();

/** 进出房串行，避免并发 join/leave 触发 -17 */
let rtcOpChain: Promise<unknown> = Promise.resolve();
let disconnectWaiters: Array<() => void> = [];

function loadAgora(appId = env.agoraAppId) {
  if (Platform.OS === 'web' || !appId) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-agora') as typeof import('react-native-agora');
  } catch {
    return null;
  }
}

function enqueueRtcOp<T>(op: () => Promise<T>): Promise<T> {
  const run = rtcOpChain.then(op, op);
  rtcOpChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function notifyDisconnected() {
  const waiters = disconnectWaiters;
  disconnectWaiters = [];
  waiters.forEach((resolve) => resolve());
}

function isDisconnectedState(state: number, agora: typeof import('react-native-agora')) {
  return (
    state === agora.ConnectionStateType.ConnectionStateDisconnected ||
    state === agora.ConnectionStateType.ConnectionStateFailed
  );
}

function waitUntilDisconnected(
  agora: typeof import('react-native-agora'),
  timeoutMs: number,
): Promise<void> {
  if (!engine) return Promise.resolve();
  try {
    if (isDisconnectedState(engine.getConnectionState(), agora)) {
      return Promise.resolve();
    }
  } catch {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      disconnectWaiters = disconnectWaiters.filter((item) => item !== finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    disconnectWaiters.push(finish);
  });
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
  return enqueueRtcOp(() => joinVoiceRtcLocked(options));
}

async function joinVoiceRtcLocked(options: {
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
  if (engine) await leaveVoiceRtcLocked();
  return createEngineAndJoin(agora, appId, options, true);
}

async function createEngineAndJoin(
  agora: typeof import('react-native-agora'),
  appId: string,
  options: {
    token: string;
    channelName: string;
    uid: number;
    callbacks?: VoiceRtcCallbacks;
  },
  allowRetryOnRejected: boolean,
) {
  if (!engine) engine = agora.createAgoraRtcEngine();
  activeCallbacks = options.callbacks;
  useVoiceRoomSessionStore.getState().setMicrophoneMuted(true);
  engine.initialize({ appId });
  engine.setChannelProfile(agora.ChannelProfileType.ChannelProfileCommunication);
  // Chatroom 场景：频繁上下麦时保持音频路由稳定在扬声器，
  // 避免 SDK 按"纯听众"角色把输出压到听筒（iOS 上表现为必须先开麦才能听到声音）
  engine.setAudioScenario(agora.AudioScenarioType.AudioScenarioChatroom);
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
    onUserMuteAudio: (_connection, uid, muted) =>
      activeCallbacks?.onUserMuted?.(String(uid), muted),
    onRemoteAudioStateChanged: (_connection, uid, state) => {
      // Starting/Decoding 说明对端音频流真实到达，即使漏掉 mute 广播也能据此纠正麦位状态
      if (state === 1 || state === 2) activeCallbacks?.onRemoteAudioActive?.(String(uid));
    },
    onAudioVolumeIndication: (_connection, speakers) => {
      activeCallbacks?.onSpeakingChanged?.(
        speakers
          .filter((speaker) => (speaker.volume ?? 0) > 20)
          .map((speaker) => String(speaker.uid)),
      );
    },
    onConnectionStateChanged: (_connection, state) => {
      if (isDisconnectedState(state, agora)) notifyDisconnected();
    },
  };
  engine.registerEventHandler(handler);
  engine.enableAudioVolumeIndication(200, 3, true);
  const result = engine.joinChannel(options.token, options.channelName, options.uid, {
    autoSubscribeAudio: true,
    publishMicrophoneTrack: false,
    clientRoleType: agora.ClientRoleType.ClientRoleBroadcaster,
  });
  if (result === ERR_JOIN_CHANNEL_REJECTED && allowRetryOnRejected) {
    // 仍被判定在频道内：完整离开并等到 Disconnected 后再试一次
    await leaveVoiceRtcLocked();
    return createEngineAndJoin(agora, appId, options, false);
  }
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
  return useVoiceRoomSessionStore.getState().microphoneMuted;
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
    if (!muted) engine.setEnableSpeakerphone(true);
    useVoiceRoomSessionStore.getState().setMicrophoneMuted(muted);
    void startVoiceRoomBackground(!muted);
    void updateVoiceRoomMicrophone(!muted);
  }
  return muteResult;
}

export async function leaveVoiceRtc() {
  return enqueueRtcOp(() => leaveVoiceRtcLocked());
}

async function leaveVoiceRtcLocked() {
  if (!engine) return;
  const current = engine;
  const agora = loadAgora();
  try {
    // 先 leave，保留 handler 以收到 Disconnected，再 release（避免未断线就 join 触发 -17）
    current.leaveChannel();
    if (agora) await waitUntilDisconnected(agora, LEAVE_DISCONNECT_TIMEOUT_MS);
  } finally {
    try {
      if (handler) current.unregisterEventHandler(handler);
      current.release();
    } catch {
      // release 在异常态下可能抛错，状态仍须清空
    }
    notifyDisconnected();
    handler = null;
    engine = null;
    activeChannelName = null;
    activeCallbacks = undefined;
    useVoiceRoomSessionStore.getState().setMicrophoneMuted(true);
    remoteUserIds.clear();
    void stopVoiceRoomBackground();
  }
}
