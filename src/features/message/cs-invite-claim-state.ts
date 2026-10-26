export type CsInviteClaimState = {
  claimed: boolean;
  enterPending: boolean;
};

/** 接单状态仅存内存（对齐 PC 端），key 带 expireAt 后缀以区分同一房间的不同邀请回合 */
const claimStates = new Map<string, CsInviteClaimState>();
const listeners = new Set<() => void>();

export function csInviteStateKey(roomId: string, roomVersion: string, expireAt?: number): string {
  return `${roomId}_${roomVersion}:${expireAt ?? 0}`;
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function getCsInviteClaimState(roomId: string, roomVersion: string, expireAt?: number): CsInviteClaimState | undefined {
  return claimStates.get(csInviteStateKey(roomId, roomVersion, expireAt));
}

export function markCsInviteClaimed(roomId: string, roomVersion: string, expireAt?: number, enterPending = false): void {
  claimStates.set(csInviteStateKey(roomId, roomVersion, expireAt), { claimed: true, enterPending });
  notify();
}

export function markCsInviteUnclaimed(roomId: string, roomVersion: string, expireAt?: number): void {
  if (claimStates.delete(csInviteStateKey(roomId, roomVersion, expireAt))) notify();
}

export function clearCsInviteClaimStates(): void {
  if (claimStates.size === 0) return;
  claimStates.clear();
  notify();
}

export function subscribeCsInviteClaimState(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
