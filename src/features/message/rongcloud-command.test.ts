import { describe, expect, it } from 'vitest';
import { parseRongCommand } from './rongcloud-command';

const enums = { private: 1, command: 10 };
const message = {
  conversationType: 1, messageType: 10, senderUserId: '50000000',
  name: 'ROOM_KICKED', data: JSON.stringify({ roomId: 12, roomVersion: 3, targetUserId: 42, banUntil: 2000 }),
};

describe('RongCloud private command routing', () => {
  it('decodes a private command without treating it as a chat message', () => {
    expect(parseRongCommand(message, enums)).toEqual({
      senderId: '50000000', name: 'ROOM_KICKED',
      data: { roomId: 12, roomVersion: 3, targetUserId: 42, banUntil: 2000 },
    });
  });

  it.each([
    { conversationType: 4 }, { messageType: 1 }, { data: '{invalid' }, { data: 'null' }, { data: '[]' },
  ])('ignores non-private commands and malformed data: %j', (overrides) => {
    expect(parseRongCommand({ ...message, ...overrides }, enums)).toBeNull();
  });
});
