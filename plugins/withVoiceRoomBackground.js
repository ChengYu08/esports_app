const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const SERVICE_NAME = 'expo.modules.voiceroombackground.VoiceRoomBackgroundService';

module.exports = function withVoiceRoomBackground(config) {
  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.RECORD_AUDIO',
    'android.permission.MODIFY_AUDIO_SETTINGS',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    'android.permission.FOREGROUND_SERVICE_MICROPHONE',
    'android.permission.POST_NOTIFICATIONS',
  ]);

  return withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    application.service = application.service || [];
    if (!application.service.some((service) => service.$?.['android:name'] === SERVICE_NAME)) {
      application.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:exported': 'false',
          'android:foregroundServiceType': 'mediaPlayback|microphone',
        },
      });
    }
    return config;
  });
};
