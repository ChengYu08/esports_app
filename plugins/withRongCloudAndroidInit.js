const {
  createRunOncePlugin,
  withMainApplication,
} = require('@expo/config-plugins');

const TAG = 'with-rongcloud-android-init';
const MARKER = '// RongCloudPush:';
const IMPORT_SNIPPETS = [
  'import io.rong.push.RongPushPlugin',
  'import expo.modules.app.toolkit.PrivacyConsentState',
  'import expo.modules.app.toolkit.RongPushHook',
];
// 隐私合规：融云及厂商推送 SDK 不得在用户同意隐私政策前初始化，
// 仅注册初始化动作；同意状态由 PrivacyConsentState 持久化，JS 同意后经 ExpoAppToolkit 触发
const INIT_SNIPPET = `    RongPushHook.initializer = { RongPushPlugin.init(this) }
    if (PrivacyConsentState.isAccepted(this)) {
      RongPushHook.tryInit()
    }`;

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

    // Add imports after the last existing import
    mod.modResults.contents = mod.modResults.contents.replace(
      /(import expo\.modules\.ApplicationLifecycleDispatcher)/,
      `${IMPORT_SNIPPETS.join('\n')}\n$1`,
    );

    // Register the deferred init before loadReactNative(this);
    // the push SDK only initializes once consent was accepted
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

module.exports = createRunOncePlugin(withRongCloudAndroidInit, TAG, '1.1.0');
