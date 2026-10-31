const {
  createRunOncePlugin,
  withMainApplication,
} = require('@expo/config-plugins');

const TAG = 'with-rongcloud-android-init';
const MARKER = '// RongCloudPush:';
const IMPORT_SNIPPET = 'import io.rong.push.RongPushPlugin';
const INIT_SNIPPET = '    RongPushPlugin.init(this)';

// Public method called by MainActivity to store push notification tap data
const INTENT_HANDLER_METHOD = `
  ${MARKER} store push notification tap data (called from MainActivity)
  fun storePushClickData(pushData: String) {
    getSharedPreferences("rong_push", android.content.Context.MODE_PRIVATE)
      .edit()
      .putString("pending_push_click", pushData)
      .putBoolean("pending_push_click_pending", true)
      .apply()
  }
`;

function withRongCloudAndroidInit(config) {
  return withMainApplication(config, (mod) => {
    if (mod.modResults.language !== 'kt') {
      throw new Error(`${TAG} requires Kotlin MainApplication.`);
    }
    if (mod.modResults.contents.includes(MARKER)) return mod;

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

    // Insert push intent handler methods at the end of the class body
    // (before the final closing brace of the class)
    const lastCloseBrace = mod.modResults.contents.lastIndexOf('}');
    if (lastCloseBrace !== -1) {
      mod.modResults.contents =
        mod.modResults.contents.slice(0, lastCloseBrace) +
        INTENT_HANDLER_METHOD +
        mod.modResults.contents.slice(lastCloseBrace);
    }

    return mod;
  });
}

module.exports = createRunOncePlugin(withRongCloudAndroidInit, TAG, '1.0.0');
