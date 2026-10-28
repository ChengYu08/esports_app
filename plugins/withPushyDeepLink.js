const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

const TAG = "with-pushy-deep-link";
/** Pushy 后台扫码测试用的自定义 scheme（填入 Deep Link 协议名） */
const PUSHY_TEST_SCHEME = "pzdjUpdate";

function hasPushyTestScheme(intentFilter) {
  const data = intentFilter.data;
  if (!data) return false;
  const list = Array.isArray(data) ? data : [data];
  return list.some((item) => item.$?.["android:scheme"] === PUSHY_TEST_SCHEME);
}

/** 为 MainActivity 注入 Pushy 测试 Deep Link 的 intent-filter */
function withPushyDeepLink(config) {
  return withAndroidManifest(config, (mod) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(
      mod.modResults,
    );
    mainActivity["intent-filter"] = mainActivity["intent-filter"] || [];

    // 已存在则跳过，避免重复写入
    if (mainActivity["intent-filter"].some(hasPushyTestScheme)) {
      return mod;
    }

    mainActivity["intent-filter"].push({
      action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
      category: [
        { $: { "android:name": "android.intent.category.DEFAULT" } },
        { $: { "android:name": "android.intent.category.BROWSABLE" } },
      ],
      data: [{ $: { "android:scheme": PUSHY_TEST_SCHEME } }],
    });

    return mod;
  });
}

module.exports = withPushyDeepLink;
module.exports.PUSHY_TEST_SCHEME = PUSHY_TEST_SCHEME;
module.exports.TAG = TAG;
