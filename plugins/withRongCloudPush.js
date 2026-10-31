const {
  AndroidConfig,
  createRunOncePlugin,
  withProjectBuildGradle,
  withAppBuildGradle,
  withGradleProperties,
  withAndroidManifest,
} = require('@expo/config-plugins');

const TAG = 'with-rongcloud-push';
const RONG_PUSH_VERSION = '5.34.2';

const VENDOR_REPOS = [
  '        // RongCloud Push 2.0 vendor repositories',
  "        maven { url 'https://maven.rongcloud.cn/repository/maven-releases' }",
  "        maven { url 'https://developer.huawei.com/repo/' }",
  "        maven { url 'https://developer.hihonor.com/repo' }",
].join('\n');
const VENDOR_PROPS = [
  ['MI_PUSH_APPID', process.env.MI_PUSH_APPID ?? ''],
  ['MI_PUSH_APPKEY', process.env.MI_PUSH_APPKEY ?? ''],
  ['OPPO_APPKEY', process.env.OPPO_APPKEY ?? ''],
  ['OPPO_APPSECRET', process.env.OPPO_APPSECRET ?? ''],
  ['VIVO_APPID', process.env.VIVO_APPID ?? ''],
  ['VIVO_APPKEY', process.env.VIVO_APPKEY ?? ''],
  ['HONOR_APPID', process.env.HONOR_APPID ?? ''],
  ['MEIZU_APPID', process.env.MEIZU_APPID ?? ''],
  ['MEIZU_APPKEY', process.env.MEIZU_APPKEY ?? ''],
];

const APP_GRADLE_SNIPPET = `
// @generated begin ${TAG}
android {
    defaultConfig {
        manifestPlaceholders = [
            RONG_PUSH_ENABLE : "true",
            XIAOMI_APP_ID    : "\\"\${MI_PUSH_APPID}\\"",
            XIAOMI_APP_KEY   : "\\"\${MI_PUSH_APPKEY}\\"",
            HW_PUSH_ENABLE   : "true",
            OPPO_APP_KEY     : "\${OPPO_APPKEY}",
            OPPO_APP_SECRET  : "\${OPPO_APPSECRET}",
            VIVO_APP_ID      : "\${VIVO_APPID}",
            VIVO_APP_KEY     : "\${VIVO_APPKEY}",
            HONOR_APP_ID     : "\${HONOR_APPID}",
            MEIZU_APP_ID     : "\${MEIZU_APPID}",
            MEIZU_APP_KEY    : "\${MEIZU_APPKEY}",
        ]
    }
}

dependencies {
    implementation "cn.rongcloud.sdk.push:rong:${RONG_PUSH_VERSION}"
    implementation "cn.rongcloud.sdk.push:xiaomi:${RONG_PUSH_VERSION}"
    implementation "cn.rongcloud.sdk.push:huawei:${RONG_PUSH_VERSION}"
    implementation "cn.rongcloud.sdk.push:oppo:${RONG_PUSH_VERSION}"
    implementation "cn.rongcloud.sdk.push:vivo:${RONG_PUSH_VERSION}"
    implementation "cn.rongcloud.sdk.push:honor:${RONG_PUSH_VERSION}"
    implementation "cn.rongcloud.sdk.push:meizu:${RONG_PUSH_VERSION}"
}
// @generated end ${TAG}
`;

function withRongCloudPush(config) {
  // 1. Add vendor Maven repos to allprojects.repositories in project-level build.gradle.
  // Must land inside the allprojects repositories block — anchoring to the first
  // bare mavenCentral() hits buildscript.repositories instead, which only resolves
  // classpath deps; app dependency resolution then fails with "Could not find".
  config = withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error(`${TAG} requires Groovy project/build.gradle.`);
    }
    if (mod.modResults.contents.includes('developer.huawei.com/repo')) return mod;
    // vendor 仓库必须插到 allprojects 内部的 repositories 块里：
    // Gradle 9 已移除项目级裸 maven() 方法，插在 allprojects { 正下方会构建失败
    const next = mod.modResults.contents.replace(
      /(allprojects\s*\{\s*\n\s*repositories\s*\{)/,
      (match) => `${match}\n${VENDOR_REPOS}`,
    );
    if (!next.includes('maven.rongcloud.cn')) {
      throw new Error(`${TAG} failed to inject vendor repositories into allprojects.repositories`);
    }
    mod.modResults.contents = next;
    return mod;
  });

  // 2. Add vendor push credentials to gradle.properties
  config = withGradleProperties(config, (mod) => {
    const properties = mod.modResults;
    VENDOR_PROPS.forEach(([key, value]) => {
      const existing = properties.find((item) => item.type === 'property' && item.key === key);
      if (existing) {
        if (existing.value !== value && value) existing.value = value;
      } else {
        properties.push({ type: 'property', key, value });
      }
    });
    return mod;
  });

  // 3. Append manifestPlaceholders + push dependencies to app-level build.gradle
  config = withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error(`${TAG} requires Groovy app/build.gradle.`);
    }
    if (mod.modResults.contents.includes(TAG)) return mod;
    mod.modResults.contents += APP_GRADLE_SNIPPET;
    return mod;
  });

  // 4. Add POST_NOTIFICATIONS permission + Honor BIND_PUSH_SERVICE query
  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.POST_NOTIFICATIONS',
  ]);

  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    if (!manifest['uses-permission']?.some((p) => p.$?.['android:name'] === 'android.permission.POST_NOTIFICATIONS')) {
      manifest['uses-permission'] = manifest['uses-permission'] || [];
      manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.POST_NOTIFICATIONS' },
      });
    }
    // Honor push requires BIND_PUSH_SERVICE query on targetSdk >= 30
    manifest.queries = manifest.queries || [];
    const hasHonorQuery = manifest.queries.some((query) =>
      query.intent?.some((intent) =>
        intent.action?.some((action) => action.$?.['android:name'] === 'com.hihonor.push.action.BIND_PUSH_SERVICE'),
      ),
    );
    if (!hasHonorQuery) {
      manifest.queries.push({
        intent: [{ action: [{ $: { 'android:name': 'com.hihonor.push.action.BIND_PUSH_SERVICE' } }] }],
      });
    }
    return mod;
  });

  return config;
}

module.exports = createRunOncePlugin(withRongCloudPush, TAG, '1.0.0');
