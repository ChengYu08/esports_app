import { Platform } from 'react-native';

type VoiceRoomBackgroundModule = {
  start: (title: string, microphoneEnabled: boolean) => Promise<void>;
  stop: () => Promise<void>;
};

function getModule() {
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeModule } = require('expo-modules-core') as typeof import('expo-modules-core');
    return requireNativeModule<VoiceRoomBackgroundModule>('VoiceRoomBackground');
  } catch {
    return null;
  }
}

export async function startVoiceRoomBackground(microphoneEnabled: boolean) {
  const module = getModule();
  if (!module) return;
  try {
    await module.start('语聊房进行中', microphoneEnabled);
  } catch (error) {
    console.warn('[voice-room] background service start failed', error);
  }
}

export async function stopVoiceRoomBackground() {
  const module = getModule();
  if (!module) return;
  try {
    await module.stop();
  } catch (error) {
    console.warn('[voice-room] background service stop failed', error);
  }
}
