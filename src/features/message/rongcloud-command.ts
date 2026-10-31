import type { RongSdkMessage } from './chat-message';

export type RongCommand = {
  senderId: string;
  name: string;
  data: Record<string, unknown>;
  /** 融云服务端时间戳（毫秒）；SDK 未提供时缺省 */
  sentTime?: number;
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
    const sentTime = typeof message.sentTime === 'number' && Number.isFinite(message.sentTime)
      ? message.sentTime
      : undefined;
    return { senderId: message.senderUserId, name: message.name, data: data as Record<string, unknown>, sentTime };
  } catch {
    return null;
  }
}
