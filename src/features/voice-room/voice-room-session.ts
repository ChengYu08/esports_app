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
  microphoneMuted: boolean;
  setMicrophoneMuted: (muted: boolean) => void;
  setActiveRoom: (room: ActiveVoiceRoom) => void;
  clearActiveRoom: (roomId?: string) => void;
};

export const useVoiceRoomSessionStore = create<VoiceRoomSessionState>((set) => ({
  activeRoom: null,
  microphoneMuted: true,
  setMicrophoneMuted: (microphoneMuted) => set({ microphoneMuted }),
  setActiveRoom: (activeRoom) => set({ activeRoom }),
  clearActiveRoom: (roomId) => set((state) => (
    !roomId || state.activeRoom?.roomId === roomId ? { activeRoom: null, microphoneMuted: true } : state
  )),
}));
