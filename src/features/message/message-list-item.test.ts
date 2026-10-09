import { expect, it } from 'vitest';

import { formatUnreadCount } from './message-unread';

it('caps visible unread labels at 99', () => {
  expect(formatUnreadCount(0)).toBe('');
  expect(formatUnreadCount(7)).toBe('7');
  expect(formatUnreadCount(120)).toBe('99+');
});
