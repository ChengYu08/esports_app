const { withAndroidStyles, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TAG = 'pz-fullscreen-splash';

// 启动图源：assets/images/splash-screen.png（竖屏 1125x2436）
// 写入 drawable 时保持同名，避免和 Expo 自动生成的 splashscreen_logo.png 冲突。
const SPLASH_IMAGE_SOURCE = path.resolve(__dirname, '../assets/images/splash-screen.png');
const SPLASH_IMAGE_NAME = 'pz_splash_fullscreen.png';

// 让 windowBackground 直接铺满全屏的 layer-list
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
 * 把 Theme.App.SplashScreen 从「系统 SplashScreen API（中央小图标）」改为
 * 「windowBackground 全屏图」。这样 Android 12+ 不会再把启动图约束在中央小区域。
 */
function setFullscreenSplashStyle(styles) {
  const { resources } = styles;
  const styleList = resources.style || [];

  // 找到 Expo 生成的 Theme.App.SplashScreen，把 parent 改掉并替换 item
  const target = styleList.find((s) => s.$?.name === 'Theme.App.SplashScreen');
  if (target) {
    target.$.parent = 'Theme.AppCompat.DayNight.NoActionBar';
    target.item = [
      { $: { name: 'android:windowBackground' }, _: '@drawable/pz_splash_window' },
    ];
  } else {
    // prebuild 时会先被 expo-splash-screen 插件创建，若没找到说明顺序变了，主动报错
    throw new Error(
      `[${TAG}] Theme.App.SplashScreen not found in styles.xml; expo-splash-screen plugin may have changed.`,
    );
  }

  // 同时给 AppTheme 加一行 windowBackground 纯色，避免主题切换后残留启动图
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
  // 1. 改 styles.xml
  config = withAndroidStyles(config, (config) => {
    config.modResults = setFullscreenSplashStyle(config.modResults);
    return config;
  });

  // 2. 写图片资源和 drawable xml（危险区：直接操作文件系统）
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

      // 2a. 写 drawable xml
      const drawableDir = path.join(resDir, 'drawable');
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.writeFileSync(
        path.join(drawableDir, 'pz_splash_window.xml'),
        WINDOW_BG_DRAWABLE,
        'utf8',
      );

      // 2b. 把竖屏启动图复制到 drawable-xxxhdpi（最高密度，Android 自动向下缩放）
      const targetDir = path.join(resDir, 'drawable-xxxhdpi');
      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(SPLASH_IMAGE_SOURCE, path.join(targetDir, SPLASH_IMAGE_NAME));

      return config;
    },
  ]);

  return config;
}

module.exports = withAndroidFullscreenSplash;
