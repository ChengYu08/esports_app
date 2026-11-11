import { describe, expect, it } from 'vitest';

import {
  applyChatRoomMemberActions,
  inviteMember,
  normalizeMembers,
  reconcileMembers,
} from './member-normalize';
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

  it('keeps local hydrated profile when the snapshot only carries placeholder nicknames', () => {
    // members 端点已瘦身：快照条目只剩 userId/role，昵称为「用户{userId}」占位
    const slim = {
      roomVersion: '3',
      creatorUserId: '10',
      serviceUserId: '20',
      members: [
        { userId: 10, role: 'owner' },
        { userId: 88, role: 'guest' },
      ],
    } as never;
    const current: VoiceRoomMember[] = [
      { userId: '10', nickname: '房主', role: 'owner', avatar: 'h10.png' },
      { userId: '88', nickname: '盼友_88', role: 'guest', avatar: 'h88.png' },
      inviteMember,
    ];
    const next = reconcileMembers(current, slim, currentUser);
    expect(next.find((member) => member.userId === '10')).toMatchObject({
      nickname: '房主',
      avatar: 'h10.png',
    });
    expect(next.find((member) => member.userId === '88')).toMatchObject({
      nickname: '盼友_88',
      avatar: 'h88.png',
    });
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

describe('applyChatRoomMemberActions', () => {
  const context = { selfId: '42', creatorUserId: '10', serviceUserId: '20' };
  const base: VoiceRoomMember[] = [
    { userId: '10', nickname: '房主', role: 'owner' },
    { userId: '42', nickname: '我', role: undefined },
    inviteMember,
  ];

  it('adds a joined member before the invite slot and assigns roles', () => {
    const next = applyChatRoomMemberActions(base, [{ userId: '88', actionType: 1 }], context);
    expect(next.map((member) => member.userId)).toEqual(['10', '42', '88', 'invite']);
    expect(next.find((member) => member.userId === '88')).toMatchObject({
      nickname: '用户88',
      role: 'guest',
    });
  });

  it('removes members on leave actions', () => {
    const joined: VoiceRoomMember[] = [...base.slice(0, 2), { userId: '88', nickname: '用户88' }, inviteMember];
    const next = applyChatRoomMemberActions(joined, [{ userId: '88', actionType: 2 }], context);
    expect(next.map((member) => member.userId)).toEqual(['10', '42', 'invite']);
  });

  it('skips self and invite actions and dedupes repeated joins', () => {
    const next = applyChatRoomMemberActions(
      base,
      [
        { userId: '42', actionType: 1 },
        { userId: 'invite', actionType: 2 },
        { userId: '10', actionType: 1 },
        { userId: '10', actionType: 1 },
      ],
      context,
    );
    expect(next.map((member) => member.userId)).toEqual(['10', '42', 'invite']);
  });

  it('keeps growing beyond 8 entries with the invite slot always last', () => {
    const filled = Array.from({ length: 10 }, (_, index) => ({
      userId: `u${index}`,
      nickname: `用户${index}`,
    }));
    const next = applyChatRoomMemberActions(
      [base[0], base[1], ...filled, inviteMember],
      [{ userId: 'a', actionType: 1 }],
      context,
    );
    expect(next).toHaveLength(14);
    expect(next.at(-1)?.userId).toBe('invite');
    expect(next.at(-2)?.userId).toBe('a');
  });
});

describe('normalizeMembers', () => {
  it('keeps every member beyond 8 and appends the invite slot last', () => {
    const detail = {
      roomVersion: '1',
      creatorUserId: 10,
      serviceUserId: 20,
      members: Array.from({ length: 10 }, (_, index) => ({ userId: index + 1 })),
    } as never;
    const next = normalizeMembers(detail, currentUser);
    expect(next.map((member) => member.userId)).toEqual([
      '10',
      '42',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'invite',
    ]);
  });
});
