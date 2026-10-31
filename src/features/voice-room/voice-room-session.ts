import { create } from 'zustand';

/**
 * 语聊房匹配选人场景（互斥，勿混用）：
 * - audition：老板一键匹配「需试音」自发进房
 * - quickMatchCreated：收到 QUICK_MATCH_CREATED（客服代发）后标记，供老板房内「选择陪玩」
 */
export type VoiceRoomScene = 'audition' | 'quickMatchCreated';

export type ActiveVoiceRoom = {
  roomId: string;
  roomVersion: string;
  rongChatroomId: string;
  roomName: string;
  creatorUserId: string;
  ownerName: string;
  ownerAvatar?: string;
  /** 匹配选人场景标记，用于底栏「选择陪玩」 */
  scene?: VoiceRoomScene;
  matchRequestNo?: string;
  matchExpireTime?: string;
  matchGameId?: string;
  matchGameName?: string;
  matchGameIconUrl?: string;
};

type VoiceRoomSessionState = {
  activeRoom: ActiveVoiceRoom | null;
  joiningRoom: ActiveVoiceRoom | null;
  lastKickedRoom: ActiveVoiceRoom | null;
  microphoneMuted: boolean;
  setMicrophoneMuted: (muted: boolean) => void;
  setActiveRoom: (room: ActiveVoiceRoom) => void;
  beginRoomJoin: (room: ActiveVoiceRoom) => void;
  completeRoomJoin: (room: ActiveVoiceRoom) => boolean;
  cancelRoomJoin: (room: ActiveVoiceRoom) => void;
  clearActiveRoom: (roomId?: string) => void;
};

// 房主主动解散的实例标记：destroy 请求触发的融云销毁事件可能先于 HTTP 响应到达，
// 命中标记的销毁事件是本人操作的结果，不弹「语聊房已关闭」（对齐 PC intentionalRoomExitInstances）
const intentionalExitInstanceKeys = new Set<string>();

export function markVoiceRoomIntentionalExit(room: { roomId: string; roomVersion: string | number }) {
  intentionalExitInstanceKeys.add(`${room.roomId}:${room.roomVersion}`);
}

export function isVoiceRoomIntentionalExit(room: { roomId: string; roomVersion: string | number }) {
  return intentionalExitInstanceKeys.has(`${room.roomId}:${room.roomVersion}`);
}

export const useVoiceRoomSessionStore = create<VoiceRoomSessionState>((set, get) => ({
  activeRoom: null,
  joiningRoom: null,
  lastKickedRoom: null,
  microphoneMuted: true,
  setMicrophoneMuted: (microphoneMuted) => set({ microphoneMuted }),
  setActiveRoom: (activeRoom) => set({ activeRoom }),
  beginRoomJoin: (joiningRoom) => set({ joiningRoom }),
  completeRoomJoin: (room) => {
    if (get().joiningRoom !== room) return false;
    set({ activeRoom: room, joiningRoom: null });
    return true;
  },
  cancelRoomJoin: (room) => {
    if (get().joiningRoom === room) set({ joiningRoom: null });
  },
  clearActiveRoom: (roomId) => set((state) => {
    if (!roomId) return { activeRoom: null, joiningRoom: null, lastKickedRoom: null, microphoneMuted: true };
    const activeRoom = state.activeRoom?.roomId === roomId ? null : state.activeRoom;
    const joiningRoom = state.joiningRoom?.roomId === roomId ? null : state.joiningRoom;
    return { activeRoom, joiningRoom, microphoneMuted: activeRoom ? state.microphoneMuted : true };
  }),
}));
