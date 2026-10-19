import { useAuthStore } from '@esports/auth';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { subscribeRongChatRoomBlocked, subscribeRongCommands } from '@/features/message/rongcloud-im';
import { handleVoiceRoomBlocked, handleVoiceRoomKicked } from '../voice-room-kicked';

function showKickedAlert() {
  Alert.alert('已退出语聊房', '你已被移出语聊房，暂时无法重新进入', [{ text: '我知道了' }], { cancelable: false });
}

// Stay subscribed when the room is minimized or covered by a private chat.
export function VoiceRoomKickListener() {
  useEffect(() => {
    const getUserId = () => {
      const { accessToken, user } = useAuthStore.getState();
      return accessToken && user?.id != null ? String(user.id) : '';
    };
    const stopCommands = subscribeRongCommands((command) => {
      void handleVoiceRoomKicked(command, getUserId(), showKickedAlert);
    });
    const stopBlocked = subscribeRongChatRoomBlocked((event) => {
      void handleVoiceRoomBlocked(event, getUserId(), showKickedAlert);
    });
    return () => { stopCommands(); stopBlocked(); };
  }, []);
  return null;
}
