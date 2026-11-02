const { withAndroidStyles, withDangerousMod } = require('expo/config-plugins');
const {
  compositeImagesAsync,
  generateImageAsync,
  generateImageBackgroundAsync,
} = require('@expo/image-utils');
const fs = require('fs');
const path = require('path');

const TAG = 'pz-fullscreen-splash';

// 与 splash-screen.png 白底对齐，避免 Android 12+ 系统 Splash → 全屏图颜色跳变。
const SPLASH_BG_COLOR = '#FFFFFF';

// 全屏启动图：API < 31 走 windowBackground；JS 侧 StartupSplash 也会再铺一遍。
const SPLASH_IMAGE_SOURCE = path.resolve(__dirname, '../assets/images/splash-screen.png');
const SPLASH_IMAGE_NAME = 'pz_splash_fullscreen.png';

// Android 12+ 系统 Splash 居中图标：覆盖 expo 生成的 splashscreen_logo.png
const SPLASH_ICON_SOURCE = path.resolve(__dirname, '../assets/images/icon.png');
const SPLASH_LOGO_FILENAME = 'splashscreen_logo.png';
/** Android SplashScreen 无 icon 底时的标准尺寸（dp） */
const SPLASH_ICON_BASE_DP = 288;
/** icon 在画布中的占比，留白边让圆形裁剪更接近全屏启动页观感 */
const SPLASH_ICON_SCALE = 0.72;

const SPLASH_LOGO_DENSITIES = [
  { folder: 'drawable-mdpi', multiplier: 1 },
  { folder: 'drawable-hdpi', multiplier: 1.5 },
  { folder: 'drawable-xhdpi', multiplier: 2 },
  { folder: 'drawable-xxhdpi', multiplier: 3 },
  { folder: 'drawable-xxxhdpi', multiplier: 4 },
];

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
 * 保留 Theme.SplashScreen（API < 31 需要 splashScreenIconSize 等 attr），
 * Android 12+ 用品牌 icon 覆盖 splashscreen_logo；旧机用 windowBackground 铺全屏图。
 */
function setFullscreenSplashStyle(styles) {
  const { resources } = styles;
  const styleList = resources.style || [];

  const target = styleList.find((s) => s.$?.name === 'Theme.App.SplashScreen');
  if (target) {
    target.$.parent = 'Theme.SplashScreen';
    target.item = [
      { $: { name: 'windowSplashScreenBackground' }, _: '@color/splashscreen_background' },
      { $: { name: 'windowSplashScreenAnimatedIcon' }, _: '@drawable/splashscreen_logo' },
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

/**
 * 用 icon.png 覆盖 expo 生成的各密度 splashscreen_logo.png（含 night，若存在）。
 * 须在 expo-splash-screen 的 dangerousMod 之后执行。
 */
async function overwriteSplashLogosWithBrandIcon(projectRoot, resDir) {
  if (!fs.existsSync(SPLASH_ICON_SOURCE)) {
    throw new Error(`[${TAG}] brand icon not found: ${SPLASH_ICON_SOURCE}`);
  }

  for (const { folder, multiplier } of SPLASH_LOGO_DENSITIES) {
    const canvasSize = Math.round(SPLASH_ICON_BASE_DP * multiplier);
    const iconSize = Math.round(canvasSize * SPLASH_ICON_SCALE);

    const background = await generateImageBackgroundAsync({
      width: canvasSize,
      height: canvasSize,
      backgroundColor: SPLASH_BG_COLOR,
      resizeMode: 'cover',
    });
    const { source: foreground } = await generateImageAsync(
      { projectRoot, cacheType: 'pz-splash-brand-logo' },
      {
        src: SPLASH_ICON_SOURCE,
        resizeMode: 'cover',
        width: iconSize,
        height: iconSize,
      },
    );
    const source = await compositeImagesAsync({
      background,
      foreground,
      x: (canvasSize - iconSize) / 2,
      y: (canvasSize - iconSize) / 2,
    });

    const lightDir = path.join(resDir, folder);
    fs.mkdirSync(lightDir, { recursive: true });
    fs.writeFileSync(path.join(lightDir, SPLASH_LOGO_FILENAME), source);

    const nightFolder = folder.replace(/^drawable-/, 'drawable-night-');
    const nightPath = path.join(resDir, nightFolder, SPLASH_LOGO_FILENAME);
    if (fs.existsSync(nightPath) || fs.existsSync(path.join(resDir, nightFolder))) {
      fs.mkdirSync(path.dirname(nightPath), { recursive: true });
      fs.writeFileSync(nightPath, source);
    }
  }

  // 清理旧方案单独拷贝的品牌图，避免残留两套资源
  const legacyBrand = path.join(resDir, 'drawable-xxxhdpi', 'pz_splash_brand_icon.png');
  if (fs.existsSync(legacyBrand)) {
    fs.unlinkSync(legacyBrand);
  }
}

function withAndroidFullscreenSplash(config) {
  config = withAndroidStyles(config, (config) => {
    config.modResults = setFullscreenSplashStyle(config.modResults);
    return config;
  });

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
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

      const targetDir = path.join(resDir, 'drawable-xxxhdpi');
      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(SPLASH_IMAGE_SOURCE, path.join(targetDir, SPLASH_IMAGE_NAME));

      await overwriteSplashLogosWithBrandIcon(projectRoot, resDir);

      return config;
    },
  ]);

  return config;
}

module.exports = withAndroidFullscreenSplash;
