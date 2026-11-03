const { withAndroidStyles, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TAG = 'pz-fullscreen-splash';

// 全屏启动图：API < 31 走 windowBackground；JS 侧 StartupSplash 也会再铺一遍。
const SPLASH_IMAGE_SOURCE = path.resolve(__dirname, '../assets/images/splash-screen.png');
const SPLASH_IMAGE_NAME = 'pz_splash_fullscreen.png';

// API 31+ 系统 splash 无法关闭，icon 也不能不设（会回退到 launcher 图标），
// 只能指向全透明 drawable 让首屏呈纯白；JS 侧 StartupSplash 的图 onDisplay 后
// 才调 SplashScreen.hide()，纯白阶段会无缝衔接到全屏图，中间不会闪白或露首页。
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

/**
 * 保留 Theme.SplashScreen（API < 31 需要 splashScreenIconSize 等 attr）：
 * API 31+ icon 置为全透明，系统 splash 呈纯白，等 JS 启动图接管；
 * API < 31 用 windowBackground 直接铺全屏图，与 JS 层同图无缝。
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
  if (appTheme) {
    const hasWindowBg = (appTheme.item || []).some(
      (i) => i.$?.name === 'android:windowBackground',
    );
    if (!hasWindowBg) {
      appTheme.item = appTheme.item || [];
      appTheme.item.push({
        $: { name: 'android:windowBackground' },
        _: '@color/splashscreen_background',
      });
    }
  }

  return styles;
}

function withAndroidFullscreenSplash(config) {
  config = withAndroidStyles(config, (config) => {
    config.modResults = setFullscreenSplashStyle(config.modResults);
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
