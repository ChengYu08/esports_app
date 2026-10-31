import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleVoiceRoomKicked, handleVoiceRoomBlocked, handleVoiceRoomDestroyed } from './voice-room-kicked';
import { useVoiceRoomSessionStore, type ActiveVoiceRoom } from './voice-room-session';
import { markVoiceRoomIntentionalExit } from './voice-room-session';
import { leaveVoiceRtc } from './voice-room-rtc';
import { leaveVoiceChatRoom } from './voice-room-rongcloud';
import { voiceRoomApi } from './voice-room.api';

vi.mock('./voice-room-rtc', () => ({ leaveVoiceRtc: vi.fn(async () => undefined) }));
vi.mock('./voice-room-rongcloud', () => ({ leaveVoiceChatRoom: vi.fn(async () => undefined) }));
vi.mock('./voice-room.api', () => ({ voiceRoomApi: { leave: vi.fn(), destroy: vi.fn() } }));

const room: ActiveVoiceRoom = {
  roomId: '12', roomVersion: '3', rongChatroomId: 'voice_12_3',
  roomName: '语聊房', creatorUserId: '10', ownerName: '房主',
};
const command = {
  senderId: '50000000', name: 'ROOM_KICKED',
  data: { roomId: 12, roomVersion: 3, targetUserId: 42, banUntil: 2000 },
};

beforeEach(() => {
  vi.clearAllMocks();
  useVoiceRoomSessionStore.setState({ activeRoom: room, joiningRoom: null, lastKickedRoom: null, microphoneMuted: false });
});

describe('being removed from a voice room', () => {
  it('immediately clears the session and notifies once, even for a minimized room', async () => {
    const notify = vi.fn();
    const task = handleVoiceRoomKicked(command, '42', notify, 1000);
    expect(useVoiceRoomSessionStore.getState()).toMatchObject({ activeRoom: null, microphoneMuted: true, lastKickedRoom: room });
    await task;
    await handleVoiceRoomKicked(command, '42', notify, 1000);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(leaveVoiceRtc).toHaveBeenCalledTimes(1);
    expect(leaveVoiceChatRoom).toHaveBeenCalledWith('voice_12_3');
    expect(voiceRoomApi.leave).not.toHaveBeenCalled();
    expect(voiceRoomApi.destroy).not.toHaveBeenCalled();
  });

  it.each([
    { senderId: '99' }, { name: 'ORDER_NOTIFY' },
    { data: { ...command.data, targetUserId: 43 } },
    { data: { ...command.data, roomId: 13 } },
    { data: { ...command.data, roomVersion: 2 } },
    { data: { ...command.data, banUntil: 1000 } },
    { data: { ...command.data, banUntil: 'invalid' } },
  ])('does not exit for an unrelated, forged or expired command: %j', async (overrides) => {
    const notify = vi.fn();
    await handleVoiceRoomKicked({ ...command, ...overrides }, '42', notify, 1000);
    expect(useVoiceRoomSessionStore.getState().activeRoom).toBe(room);
    expect(leaveVoiceRtc).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('cancels a pending join so its late completion cannot restore the kicked session', async () => {
    useVoiceRoomSessionStore.setState({ activeRoom: null, joiningRoom: room });
    await handleVoiceRoomKicked(command, '42', vi.fn(), 1000);
    expect(useVoiceRoomSessionStore.getState().completeRoomJoin(room)).toBe(false);
    expect(useVoiceRoomSessionStore.getState()).toMatchObject({ activeRoom: null, joiningRoom: null });
  });

  it('still exits and notifies when one SDK cleanup fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(leaveVoiceChatRoom).mockRejectedValueOnce(new Error('already blocked'));
    const notify = vi.fn();
    await handleVoiceRoomKicked(command, '42', notify, 1000);
    expect(useVoiceRoomSessionStore.getState().activeRoom).toBeNull();
    expect(leaveVoiceRtc).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('handles the SDK block event once when the command also arrives', async () => {
    const notify = vi.fn();
    await handleVoiceRoomBlocked({ chatroomId: 'voice_12_3', userIdList: ['42'] }, '42', notify);
    await handleVoiceRoomKicked(command, '42', notify, 1000);
    expect(useVoiceRoomSessionStore.getState().activeRoom).toBeNull();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('ignores block events for other users or room instances', async () => {
    const notify = vi.fn();
    await handleVoiceRoomBlocked({ chatroomId: 'voice_12_2', userIdList: ['42'] }, '42', notify);
    await handleVoiceRoomBlocked({ chatroomId: 'voice_12_3', userIdList: ['43'] }, '42', notify);
    expect(useVoiceRoomSessionStore.getState().activeRoom).toBe(room);
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not clear a new room when an old SDK cleanup finishes', async () => {
    let finishCleanup!: () => void;
    vi.mocked(leaveVoiceChatRoom).mockImplementationOnce(() => new Promise<void>((resolve) => { finishCleanup = resolve; }));
    const task = handleVoiceRoomKicked(command, '42', vi.fn(), 1000);
    const nextRoom = { ...room, roomId: '13', rongChatroomId: 'voice_13_3' };
    useVoiceRoomSessionStore.getState().beginRoomJoin(nextRoom);
    expect(useVoiceRoomSessionStore.getState().completeRoomJoin(nextRoom)).toBe(true);
    finishCleanup();
    await task;
    expect(useVoiceRoomSessionStore.getState().activeRoom).toBe(nextRoom);
  });

  it('cancels an in-progress join when the session is cleared', () => {
    useVoiceRoomSessionStore.setState({ activeRoom: null });
    useVoiceRoomSessionStore.getState().beginRoomJoin(room);
    useVoiceRoomSessionStore.getState().clearActiveRoom(room.roomId);
    expect(useVoiceRoomSessionStore.getState().completeRoomJoin(room)).toBe(false);
    expect(useVoiceRoomSessionStore.getState().activeRoom).toBeNull();
  });
});

describe('when the voice room chatroom is destroyed', () => {
  it('clears the session, leaves both SDKs and notifies for the current room', async () => {
    const notify = vi.fn();
    await handleVoiceRoomDestroyed('voice_12_3', notify);
    expect(useVoiceRoomSessionStore.getState()).toMatchObject({ activeRoom: null, microphoneMuted: true, lastKickedRoom: room });
    expect(leaveVoiceRtc).toHaveBeenCalledTimes(1);
    expect(leaveVoiceChatRoom).toHaveBeenCalledWith('voice_12_3');
    expect(voiceRoomApi.leave).not.toHaveBeenCalled();
    expect(voiceRoomApi.destroy).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending join so its late completion cannot restore the destroyed session', async () => {
    useVoiceRoomSessionStore.setState({ activeRoom: null, joiningRoom: room });
    await handleVoiceRoomDestroyed('voice_12_3', vi.fn());
    expect(useVoiceRoomSessionStore.getState().completeRoomJoin(room)).toBe(false);
    expect(useVoiceRoomSessionStore.getState()).toMatchObject({ activeRoom: null, joiningRoom: null });
  });

  it.each(['', 'voice_12_2', 'voice_13_3'])('ignores empty or unrelated chatroom ids: %s', async (chatroomId) => {
    const notify = vi.fn();
    await handleVoiceRoomDestroyed(chatroomId, notify);
    expect(useVoiceRoomSessionStore.getState().activeRoom).toBe(room);
    expect(notify).not.toHaveBeenCalled();
    expect(leaveVoiceRtc).not.toHaveBeenCalled();
  });

  it('does not notify twice for repeated destroy events', async () => {
    const notify = vi.fn();
    await handleVoiceRoomDestroyed('voice_12_3', notify);
    await handleVoiceRoomDestroyed('voice_12_3', notify);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('ignores the destroy event when the owner exit marked the instance as intentional', async () => {
    markVoiceRoomIntentionalExit(room);
    const notify = vi.fn();
    await handleVoiceRoomDestroyed('voice_12_3', notify);
    expect(notify).not.toHaveBeenCalled();
    expect(leaveVoiceRtc).not.toHaveBeenCalled();
    expect(useVoiceRoomSessionStore.getState().activeRoom).toBe(room);
  });

  it('still notifies a new room instance reopened after an intentional exit', async () => {
    markVoiceRoomIntentionalExit(room);
    const nextRoom = { ...room, roomVersion: '4', rongChatroomId: 'voice_12_4' };
    useVoiceRoomSessionStore.setState({ activeRoom: nextRoom });
    const notify = vi.fn();
    await handleVoiceRoomDestroyed('voice_12_4', notify);
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
