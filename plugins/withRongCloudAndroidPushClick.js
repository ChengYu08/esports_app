const {
  createRunOncePlugin,
  withMainActivity,
} = require('@expo/config-plugins');

const TAG = 'with-rongcloud-android-push-click';
const MARKER = '// RongCloudPushActivity:';

// Injected into existing onCreate body: handle cold-start push tap (app killed → tap notification)
const ONCREATE_INJECT = `
    ${MARKER} handle cold-start push tap
    handlePushClickIntent(intent)`;

// New methods added to the class (onNewIntent + handlePushClickIntent)
const NEW_METHODS = `
  ${MARKER} handle warm-start push tap
  override fun onNewIntent(intent: android.content.Intent?) {
    super.onNewIntent(intent)
    handlePushClickIntent(intent)
  }

  private fun handlePushClickIntent(intent: android.content.Intent?) {
    val pushData = intent?.getStringExtra("pushData") ?: return
    (application as? MainApplication)?.storePushClickData(pushData)
  }
`;

function withRongCloudAndroidPushClick(config) {
  return withMainActivity(config, (mod) => {
    if (mod.modResults.language !== 'kt') {
      throw new Error(`${TAG} requires Kotlin MainActivity.`);
    }
    if (mod.modResults.contents.includes(MARKER)) return mod;

    // 1. Inject handlePushClickIntent(intent) call into existing onCreate,
    //    right after super.onCreate(null)
    mod.modResults.contents = mod.modResults.contents.replace(
      /(override fun onCreate\(savedInstanceState: Bundle\?\) \{[\s\S]*?super\.onCreate\(null\)\n)/,
      `$1${ONCREATE_INJECT}\n`,
    );

    // 2. Insert onNewIntent + handlePushClickIntent methods before class closing brace
    const lastCloseBrace = mod.modResults.contents.lastIndexOf('}');
    if (lastCloseBrace !== -1) {
      mod.modResults.contents =
        mod.modResults.contents.slice(0, lastCloseBrace) +
        NEW_METHODS +
        mod.modResults.contents.slice(lastCloseBrace);
    }

    return mod;
  });
}

module.exports = createRunOncePlugin(withRongCloudAndroidPushClick, TAG, '1.0.0');
