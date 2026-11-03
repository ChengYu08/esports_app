import type { RCIMIWConversation, RCIMIWConversationType, RCIMIWEngine } from '@rongcloud/react-native-im-wrapper';

import { logger } from '@/core/logging/logger';

type ConversationEngine = Pick<RCIMIWEngine,
  'getConversations' | 'getRemoteConversationList' | 'setOnRemoteConversationListSyncedListener'
>;

/** 不允许主动拉取远端会话（官方 33301）。 */
const REMOTE_PULL_NOT_ALLOWED_CODE = 33301;
/** AppKey 开启会话自动拉取时，手动 getRemoteConversationList 常见返回码。 */
const AUTO_PULL_CONVERSATION_CODE = 33302;

const REMOTE_SYNC_SOFT_SUCCESS_CODES = new Set([
  REMOTE_PULL_NOT_ALLOWED_CODE,
  AUTO_PULL_CONVERSATION_CODE,
]);

const pendingSyncs = new WeakMap<ConversationEngine, Promise<void>>();
/** 已成功同步过服务端目录的引擎：同一连接内不重复触发，换账号/清库后本地为空会重新同步。 */
const syncedEngines = new WeakSet<ConversationEngine>();

function syncError(code: number) {
  return new Error(`消息同步失败（${code}）`);
}

function settleRemoteSync(
  code: number,
  resolve: () => void,
  reject: (error: Error) => void,
) {
  if (code === 0) {
    resolve();
    return;
  }
  const softSuccess = REMOTE_SYNC_SOFT_SUCCESS_CODES.has(code);
  logger.warn('RongCloud remote conversation sync failed', {
    code,
    softSuccess,
  });
  if (softSuccess) {
    resolve();
    return;
  }
  reject(syncError(code));
}

function synchronizeRemoteConversations(engine: ConversationEngine): Promise<void> {
  const pending = pendingSyncs.get(engine);
  if (pending) return pending;

  // This SDK has one remote-sync listener per engine. Concurrent reads must
  // share the request so they cannot replace each other's completion listener.
  let timeout: ReturnType<typeof setTimeout>;
  const synchronization = new Promise<void>((resolve, reject) => {
    timeout = setTimeout(() => reject(new Error('消息同步超时，请重试')), 15_000);
    engine.setOnRemoteConversationListSyncedListener((code) => {
      settleRemoteSync(code, resolve, reject);
    });
    // onSuccess only acknowledges the request; the listener confirms the DB
    // has been updated and it is safe to read the local conversation snapshot.
    // 33301/33302 mean active remote pull is not allowed (e.g. auto-pull on) —
    // treat as soft success and read local later.
    void engine.getRemoteConversationList({
      onError: (code) => settleRemoteSync(code, resolve, reject),
    }).then((code) => {
      if (code !== 0) settleRemoteSync(code, resolve, reject);
    }).catch(reject);
  }).finally(() => {
    clearTimeout(timeout);
    engine.setOnRemoteConversationListSyncedListener();
    pendingSyncs.delete(engine);
  });
  pendingSyncs.set(engine, synchronization);
  return synchronization;
}

function readLocalConversations(engine: ConversationEngine, conversationType: RCIMIWConversationType) {
  return new Promise<RCIMIWConversation[]>((resolve, reject) => {
    void engine.getConversations([conversationType], '', 0, 50, {
      onSuccess: (conversations) => resolve(conversations || []),
      onError: (code) => reject(new Error(`消息列表加载失败（${code}）`)),
    }).then((code) => {
      if (code !== 0) reject(new Error(`消息列表加载失败（${code}）`));
    }).catch(reject);
  });
}

export async function loadConversationSnapshot(
  engine: ConversationEngine,
  conversationType: RCIMIWConversationType,
): Promise<RCIMIWConversation[]> {
  const conversations = await readLocalConversations(engine, conversationType);
  // 离线补偿只覆盖窗口内（默认 1 天）的会话，重装后"前几天发过消息的人"只存在于
  // 服务端目录里——本地非空也必须同步一次目录，否则列表只剩最近联系人。
  if (conversations.length === 0 || !syncedEngines.has(engine)) {
    try {
      await synchronizeRemoteConversations(engine);
      syncedEngines.add(engine);
    } catch (error) {
      // 目录同步失败但本地有数据时降级为本地列表，不能让列表整体挂掉
      if (conversations.length > 0) {
        logger.warn('RongCloud remote conversation sync failed, falling back to local conversations', {
          reason: error instanceof Error ? error.message : String(error),
        });
        return conversations;
      }
      throw error;
    }
  }
  return readLocalConversations(engine, conversationType);
}
