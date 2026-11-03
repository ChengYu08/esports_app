const { withAndroidStyles, withDangerousMod, withMainActivity } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TAG = 'pz-fullscreen-splash';

// 全屏启动图：全版本走 windowBackground 方案。31+ 系统 splash 在窗口首帧即结束，
// 随后全屏图接管；<31 本就直接以 windowBackground 呈现。JS 侧 StartupSplash 渲染
// 同一张图，与 windowBackground 无缝重叠，内容 ready 后进首页。
const SPLASH_IMAGE_SOURCE = path.resolve(__dirname, '../assets/images/splash-screen.png');
const SPLASH_IMAGE_NAME = 'pz_splash_fullscreen.png';

// API 31+ 系统 splash 无法关闭，icon 也不能不设（会回退到 launcher 图标），
// 只能指向全透明 drawable 让系统 splash 呈纯白，窗口首帧即被全屏图接管。
const BLANK_ICON_NAME = 'pz_splash_blank.xml';
const BLANK_ICON_DRAWABLE = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#00000000" />
</shape>
`;

const WINDOW_BG_DRAWABLE = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splashscreen_background" />
    <item>
        <bitmap
            android:gravity="fill_horizontal|fill_vertical"
            android:src="@drawable/pz_splash_fullscreen" />
    </item>
</layer-list>
`;

// 替换 expo-splash-screen 在 MainActivity 生成的 registerOnActivity：
// 其 onPreDraw 拦截会把窗口首帧推迟到 React 内容出现，全屏图无法提前接管。
const MAIN_ACTIVITY_PATCH_MARKER = 'pz-fullscreen-splash windowBackground';
// 还原白色窗口背景的延时：JS 启动图在 React 挂载即开始解码，700ms 后基本已绘制
// （React 层不透明，换底色不可见），且早于首页 fade 转场的透明期。
const MAIN_ACTIVITY_PATCH_BODY = `    // ${MAIN_ACTIVITY_PATCH_MARKER}
    setTheme(R.style.AppTheme)
    val restoreWindowBackground = object : ReactMarker.MarkerListener {
      override fun logMarker(name: ReactMarkerConstants, tag: String?, instanceKey: Int) {
        if (name == ReactMarkerConstants.CONTENT_APPEARED) {
          ReactMarker.removeListener(this)
          runOnUiThread {
            window.decorView.postDelayed(
              { window.setBackgroundDrawable(ColorDrawable(0xFFFFFFFF.toInt())) },
              700L,
            )
          }
        }
      }
    }
    ReactMarker.addListener(restoreWindowBackground)`;

const MAIN_ACTIVITY_PATCH_IMPORTS = [
  'import android.graphics.drawable.ColorDrawable',
  'import com.facebook.react.bridge.ReactMarker',
  'import com.facebook.react.bridge.ReactMarkerConstants',
];

/**
 * 保留 Theme.SplashScreen（API < 31 需要 splashScreenIconSize 等 attr）：
 * API 31+ icon 置为全透明，系统 splash 呈纯白且在窗口首帧即结束；
 * AppTheme.windowBackground 换成全屏图，全版本由 windowBackground 承载启动图。
 */
function setFullscreenSplashStyle(styles) {
  const { resources } = styles;
  const styleList = resources.style || [];

  const target = styleList.find((s) => s.$?.name === 'Theme.App.SplashScreen');
  if (target) {
    target.$.parent = 'Theme.SplashScreen';
    target.item = [
      { $: { name: 'windowSplashScreenBackground' }, _: '@color/splashscreen_background' },
      { $: { name: 'windowSplashScreenAnimatedIcon' }, _: '@drawable/pz_splash_blank' },
      { $: { name: 'postSplashScreenTheme' }, _: '@style/AppTheme' },
      { $: { name: 'android:windowBackground' }, _: '@drawable/pz_splash_window' },
    ];
  } else {
    throw new Error(
      `[${TAG}] Theme.App.SplashScreen not found in styles.xml; expo-splash-screen plugin may have changed.`,
    );
  }

  const appTheme = styleList.find((s) => s.$?.name === 'AppTheme');
  if (!appTheme) {
    throw new Error(`[${TAG}] AppTheme not found in styles.xml; expo prebuild template may have changed.`);
  }
  appTheme.item = appTheme.item || [];
  // windowBackground 用全屏启动图：React 首帧出现前由它兜底展示，
  // 之后 MainActivity 的监听会把窗口背景还原成纯白，避免启动图透过透明 UI 泄漏。
  const windowBg = appTheme.item.find((i) => i.$?.name === 'android:windowBackground');
  if (windowBg) {
    windowBg._ = '@drawable/pz_splash_window';
  } else {
    appTheme.item.push({
      $: { name: 'android:windowBackground' },
      _: '@drawable/pz_splash_window',
    });
  }

  return styles;
}

function patchMainActivity(contents, language) {
  if (language === 'java') {
    throw new Error(`[${TAG}] MainActivity.java is not supported; kotlin only.`);
  }

  const blockRe =
    /( *\/\/ @generated begin expo-splashscreen[^\n]*\n)([\s\S]*?)( *\/\/ @generated end expo-splashscreen\n)/;
  const match = contents.match(blockRe);
  if (!match) {
    throw new Error(
      `[${TAG}] expo-splashscreen generated block not found in MainActivity.kt; expo-splash-screen plugin may have changed.`,
    );
  }
  if (
    !match[2].includes('SplashScreenManager.registerOnActivity(this)') &&
    !match[2].includes(MAIN_ACTIVITY_PATCH_MARKER)
  ) {
    throw new Error(
      `[${TAG}] unexpected expo-splashscreen block content in MainActivity.kt; expo-splash-screen plugin may have changed.`,
    );
  }

  // Expo mod 链是后注册先执行：本插件须排在 app.json 里 expo-splash-screen 之前，
  // 这样本 patch 在 splash 写入 registerOnActivity 之后执行，才能覆盖掉它。
  // 每次都重写为规范形态（splash 会注释掉原 setTheme 并补回 SplashScreenManager import）。
  let patched = contents.replace(
    blockRe,
    (m, begin, body, end) => `${begin}${MAIN_ACTIVITY_PATCH_BODY}\n${end}`,
  );

  patched = patched.replace(/import expo\.modules\.splashscreen\.SplashScreenManager\n/, '');
  for (const statement of MAIN_ACTIVITY_PATCH_IMPORTS) {
    if (!patched.includes(`${statement}\n`)) {
      patched = patched.replace(/^(import .*\n)/m, `${statement}\n$1`);
    }
  }
  return patched;
}

function withAndroidFullscreenSplash(config) {
  config = withAndroidStyles(config, (config) => {
    config.modResults = setFullscreenSplashStyle(config.modResults);
    return config;
  });

  config = withMainActivity(config, (config) => {
    config.modResults.contents = patchMainActivity(
      config.modResults.contents,
      config.modResults.language,
    );
    return config;
  });

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const resDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
      );

      const drawableDir = path.join(resDir, 'drawable');
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.writeFileSync(
        path.join(drawableDir, 'pz_splash_window.xml'),
        WINDOW_BG_DRAWABLE,
        'utf8',
      );
      fs.writeFileSync(path.join(drawableDir, BLANK_ICON_NAME), BLANK_ICON_DRAWABLE, 'utf8');

      const targetDir = path.join(resDir, 'drawable-xxxhdpi');
      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(SPLASH_IMAGE_SOURCE, path.join(targetDir, SPLASH_IMAGE_NAME));

      return config;
    },
  ]);

  return config;
}

module.exports = withAndroidFullscreenSplash;
// 导出仅供一次性验证补丁逻辑使用
module.exports.patchMainActivity = patchMainActivity;
