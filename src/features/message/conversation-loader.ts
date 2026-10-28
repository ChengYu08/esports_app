import type { RCIMIWConversation, RCIMIWConversationType, RCIMIWEngine } from '@rongcloud/react-native-im-wrapper';

type ConversationEngine = Pick<RCIMIWEngine,
  'getConversations' | 'getRemoteConversationList' | 'setOnRemoteConversationListSyncedListener'
>;

/** AppKey 开启会话自动拉取时，手动 getRemoteConversationList 会返回此码。 */
const AUTO_PULL_CONVERSATION_CODE = 33302;

const pendingSyncs = new WeakMap<ConversationEngine, Promise<void>>();

function syncError(code: number) {
  return new Error(code === 33301 ? '历史消息同步暂不可用（33301）' : `消息同步失败（${code}）`);
}

function settleRemoteSync(
  code: number,
  resolve: () => void,
  reject: (error: Error) => void,
) {
  if (code === 0 || code === AUTO_PULL_CONVERSATION_CODE) {
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
    // 33302 means auto-pull is on — treat as soft success and read local later.
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
  if (conversations.length > 0) return conversations;

  // Reinstalling or signing in on a new device leaves the SDK's local DB empty.
  // Restore the server snapshot before declaring that the user has no messages.
  // When auto-pull is enabled (33302), skip failing and re-read local; offline
  // sync completion will refresh the list via subscribeConversationSync.
  await synchronizeRemoteConversations(engine);
  return readLocalConversations(engine, conversationType);
}
