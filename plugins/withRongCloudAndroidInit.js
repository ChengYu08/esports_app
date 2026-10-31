const {
  createRunOncePlugin,
  withMainApplication,
} = require('@expo/config-plugins');

const TAG = 'with-rongcloud-android-init';
const IMPORT_SNIPPET = 'import cn.rongcloud.push.RongPushPlugin';
const INIT_SNIPPET = '    RongPushPlugin.init(this)';

function withRongCloudAndroidInit(config) {
  return withMainApplication(config, (mod) => {
    if (mod.modResults.language !== 'kt') {
      throw new Error(`${TAG} requires Kotlin MainApplication.`);
    }
    if (mod.modResults.contents.includes(TAG)) return mod;

    // Add import after the last existing import
    mod.modResults.contents = mod.modResults.contents.replace(
      /(import expo\.modules\.ApplicationLifecycleDispatcher)/,
      `${IMPORT_SNIPPET}\n$1`,
    );

    // Insert RongPushPlugin.init(this) as the first statement in onCreate(),
    // before loadReactNative(this) so it runs before the JS engine (and thus IM SDK) initializes
    mod.modResults.contents = mod.modResults.contents.replace(
      /(override fun onCreate\(\) \{\n\s*super\.onCreate\(\)\n)/,
      `$1${INIT_SNIPPET}\n`,
    );

    return mod;
  });
}

module.exports = createRunOncePlugin(withRongCloudAndroidInit, TAG, '1.0.0');
