import type {
  IRCIMIWGetMessagesCallback,
  RCIMIWConversationType,
  RCIMIWEngine,
  RCIMIWMessage,
  RCIMIWMessageOperationPolicy,
  RCIMIWTimeOrder,
} from '@rongcloud/react-native-im-wrapper';

import { logger } from '@/core/logging/logger';

export type RongHistoryEngine = Pick<RCIMIWEngine, 'getMessages'>;

export type RongHistoryRequest = {
  conversationType: RCIMIWConversationType;
  targetId: string;
  sentTime: number;
  order: RCIMIWTimeOrder;
  count: number;
  remotePolicy: RCIMIWMessageOperationPolicy;
  localPolicy: RCIMIWMessageOperationPolicy;
};

/**
 * 单策略拉取：成功返回消息数组（可能为空），提交失败或回调报错返回 null。
 * 探针实测：LOCAL_REMOTE 在本地库为空时不会去云端拉，所以远端兜底必须显式用 REMOTE 策略。
 */
function pullByPolicy(engine: RongHistoryEngine, request: RongHistoryRequest, policy: RCIMIWMessageOperationPolicy): Promise<RCIMIWMessage[] | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (messages: RCIMIWMessage[] | null) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(messages);
      }
    };
    // SDK 受理后可能不再回调，限时回落本地查询，避免聊天页永久加载。
    const timer = setTimeout(() => finish(null), 15_000);
    const callback: IRCIMIWGetMessagesCallback = {
      onSuccess: (messages) => finish(messages || []),
      onError: (code) => {
        logger.warn('RongCloud history pull error', { policy: policy as number, errorCode: code });
        finish(null);
      },
    };
    Promise.resolve().then(() => engine.getMessages(
      request.conversationType,
      request.targetId,
      '',
      request.sentTime,
      request.order,
      policy,
      request.count,
      callback,
    )).then((code) => {
      if (code !== 0) {
        logger.warn('RongCloud history pull submit failed', { policy: policy as number, errorCode: code });
        finish(null);
      }
    }).catch(() => finish(null));
  });
}

/**
 * 远端优先拉取历史消息：先 REMOTE 拉云端，拿到消息直接返回；
 * 云端拉取失败（如 30001 通道未就绪、网络错误）或云端无消息时，回退 LOCAL_REMOTE 读本地库，
 * 避免换机/重装后本地库为空导致聊天页空白（云端消息永远优先，不会因本地有数据被忽略）。
 */
export async function fetchRongHistoryMessages(
  engine: RongHistoryEngine,
  request: RongHistoryRequest,
): Promise<RCIMIWMessage[]> {
  const remote = await pullByPolicy(engine, request, request.remotePolicy);
  if (remote === null) {
    return (await pullByPolicy(engine, request, request.localPolicy)) || [];
  }
  if (remote.length > 0) {
    return remote;
  }
  return (await pullByPolicy(engine, request, request.localPolicy)) || [];
}
