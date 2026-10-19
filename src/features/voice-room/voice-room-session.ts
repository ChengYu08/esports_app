import { create } from 'zustand';

export type ActiveVoiceRoom = {
  roomId: string;
  roomVersion: string;
  rongChatroomId: string;
  roomName: string;
  creatorUserId: string;
  ownerName: string;
  ownerAvatar?: string;
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
