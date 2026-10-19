import { describe, expect, it } from 'vitest';
import { canKickVoiceRoomMember, getMemberAge } from './member-profile';

const room = { roomVersion: 3, creatorUserId: 10, serviceUserId: 20 };

describe('voice room member permissions', () => {
  it('allows the owner and current receptionist to remove an ordinary member', () => {
    expect(canKickVoiceRoomMember(room, '10', '30')).toBe(true);
    expect(canKickVoiceRoomMember(room, '20', '30')).toBe(true);
  });

  it('protects self, owner, receptionist and the invitation slot', () => {
    for (const viewer of ['10', '20']) {
      for (const target of ['10', '20', 'invite', undefined]) {
        expect(canKickVoiceRoomMember(room, viewer, target)).toBe(false);
      }
    }
  });

  it('denies guests, missing room data and an expired receptionist assignment', () => {
    expect(canKickVoiceRoomMember(room, '30', '40')).toBe(false);
    expect(canKickVoiceRoomMember(null, '10', '30')).toBe(false);
    expect(canKickVoiceRoomMember(room, undefined, '30')).toBe(false);
    expect(canKickVoiceRoomMember({ ...room, serviceUserId: 40 }, '20', '30')).toBe(false);
  });
});

describe('member age', () => {
  const now = new Date(2026, 9, 19, 12);
  it('uses the birthday boundary, not just the year difference', () => {
    expect(getMemberAge('2002-10-20', now)).toBe('23');
    expect(getMemberAge('2002-10-19', now)).toBe('24');
    expect(getMemberAge('2002-10-18', now)).toBe('24');
  });
  it('does not invent an age for missing, invalid or future dates', () => {
    expect(getMemberAge(undefined, now)).toBe('');
    expect(getMemberAge('unknown', now)).toBe('');
    expect(getMemberAge('2027-01-01', now)).toBe('');
  });
});
