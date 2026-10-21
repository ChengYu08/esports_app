import { PermissionsAndroid, Platform } from 'react-native';

type VoiceRoomBackgroundModule = {
  start: (title: string, microphoneEnabled: boolean) => Promise<void>;
  stop: () => Promise<void>;
  updateMicrophone?: (enabled: boolean) => Promise<void>;
};

let cachedModule: VoiceRoomBackgroundModule | null | undefined;
let notificationPermissionRequested = false;

function getModule() {
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeModule } = require('expo-modules-core') as typeof import('expo-modules-core');
    cachedModule = requireNativeModule<VoiceRoomBackgroundModule>('VoiceRoomBackground');
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

async function ensureAndroidNotificationPermission() {
  if (Platform.OS !== 'android') return;
  if (Platform.Version < 33) return;
  if (notificationPermissionRequested) return;
  notificationPermissionRequested = true;
  try {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      {
        title: '通知权限',
        message: '语聊房需要在通知栏显示通话状态',
        buttonPositive: '允许',
        buttonNegative: '拒绝',
      },
    );
  } catch (error) {
    console.warn('[voice-room] request notification permission failed', error);
  }
}

export async function startVoiceRoomBackground(microphoneEnabled: boolean) {
  const module = getModule();
  if (!module) return;
  try {
    await ensureAndroidNotificationPermission();
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

export async function updateVoiceRoomMicrophone(enabled: boolean) {
  const module = getModule();
  if (!module?.updateMicrophone) return;
  try {
    await module.updateMicrophone(enabled);
  } catch (error) {
    console.warn('[voice-room] update microphone state failed', error);
  }
}
