export type TeenRequestSnapshot = {
  session: number;
  revision: number;
};

/** 登录会话与账号内状态操作版本：同时命中才允许异步结果落地。 */
export function createTeenRequestGuard() {
  let session = 0;
  let revision = 0;

  return {
    beginSession() {
      session += 1;
      revision = 0;
      return session;
    },
    snapshot(): TeenRequestSnapshot {
      return { session, revision };
    },
    isSessionCurrent(expectedSession: number) {
      return expectedSession === session;
    },
    isCurrent(snapshot: TeenRequestSnapshot) {
      return snapshot.session === session && snapshot.revision === revision;
    },
    invalidateStatus() {
      revision += 1;
    },
  };
}
