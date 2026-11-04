import { logger } from '@/core/logging/logger';

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
    || !message.senderUserId || !message.name) {
    logger.warn('rong_command.parse_failed', {
      reason: '非私聊命令消息或缺少必要字段',
      conversationType: message.conversationType,
      expectedConversationType: enums.private,
      messageType: message.messageType,
      expectedMessageType: enums.command,
      hasSenderUserId: Boolean(message.senderUserId),
      hasName: Boolean(message.name),
    });
    return null;
  }
  try {
    const data: unknown = typeof message.data === 'string' ? JSON.parse(message.data) : message.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      logger.warn('rong_command.parse_failed', {
        reason: 'data 字段不是 JSON 对象',
        name: message.name,
        senderId: message.senderUserId,
      });
      return null;
    }
    const sentTime = typeof message.sentTime === 'number' && Number.isFinite(message.sentTime)
      ? message.sentTime
      : undefined;
    return { senderId: message.senderUserId, name: message.name, data: data as Record<string, unknown>, sentTime };
  } catch (error) {
    logger.warn('rong_command.parse_failed', {
      reason: 'data 字段 JSON 解析失败',
      name: message.name,
      senderId: message.senderUserId,
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return null;
  }
}
