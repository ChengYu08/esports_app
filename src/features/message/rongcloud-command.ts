import type { RongSdkMessage } from './chat-message';

export type RongCommand = {
  senderId: string;
  name: string;
  data: Record<string, unknown>;
};

export function parseRongCommand(
  message: RongSdkMessage & { conversationType?: number },
  enums: { private: number; command: number },
): RongCommand | null {
  if (message.conversationType !== enums.private || message.messageType !== enums.command
    || !message.senderUserId || !message.name) return null;
  try {
    const data: unknown = typeof message.data === 'string' ? JSON.parse(message.data) : message.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    return { senderId: message.senderUserId, name: message.name, data: data as Record<string, unknown> };
  } catch {
    return null;
  }
}
