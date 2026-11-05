import { describe, expect, it } from 'vitest';

import { inviteMember, normalizeMembers, reconcileMembers } from './member-normalize';
import type { VoiceRoomMember } from './voice-room.types';

const currentUser = { id: '42', nickname: '我', headImage: 'self.png' };

describe('reconcileMembers', () => {
  const detail = {
    roomVersion: '3',
    creatorUserId: '10',
    serviceUserId: '20',
    members: [
      { userId: 10, nickname: '房主', role: 'owner' },
      { userId: 20, nickname: '接待', role: 'service' },
      { userId: 88, nickname: '新客', role: 'guest' },
    ],
  } as never;

  it('removes members the backend no longer reports and adds missing ones', () => {
    const stale: VoiceRoomMember[] = [
      { userId: '10', nickname: '房主', role: 'owner' },
      { userId: '99', nickname: '用户99', role: 'guest', micOpen: true },
      { userId: '88', nickname: '用户88', role: 'guest' },
      inviteMember,
    ];
    const next = reconcileMembers(stale, detail, currentUser);
    expect(next.map((member) => member.userId)).toEqual(['10', '42', '20', '88', 'invite']);
    expect(next.find((member) => member.userId === '88')?.nickname).toBe('新客');
  });

  it('keeps local mic and speaking state for members that survive', () => {
    const current: VoiceRoomMember[] = [
      { userId: '10', nickname: '房主', role: 'owner', micOpen: true, speaking: true },
      { userId: '20', nickname: '接待', role: 'service' },
      inviteMember,
    ];
    const next = reconcileMembers(current, detail, currentUser);
    expect(next.find((member) => member.userId === '10')).toMatchObject({ micOpen: true, speaking: true });
    expect(next.find((member) => member.userId === '20')?.micOpen).toBeUndefined();
  });

  it('falls back to the normalized baseline when the detail carries no members', () => {
    const current: VoiceRoomMember[] = [
      { userId: '99', nickname: '残留用户', role: 'guest' },
      inviteMember,
    ];
    const next = reconcileMembers(current, { roomVersion: '3' }, currentUser);
    expect(next.map((member) => member.userId)).toEqual(['42', 'invite']);
  });

  it('matches normalizeMembers ordering for a fresh room', () => {
    const next = reconcileMembers([], detail, currentUser);
    expect(next).toEqual(normalizeMembers(detail, currentUser));
  });
});
