const { createRunOncePlugin, withAndroidStyles } = require('expo/config-plugins');

const TAG = 'withDisableElegantTextHeight';
const EDIT_TEXT_STYLE = 'PzEditText';
const TEXT_VIEW_STYLE = 'PzTextView';

/**
 * Android 15（targetSdk 35）两处默认会抬高输入框竖向度量：
 * 1) elegantTextHeight=true
 * 2) useLocalePreferredLineHeightForMinimum=true（按语言预留最小行高，光标明显高于中文字形）
 * 在 AppTheme / EditText / TextView 上回退旧行为。
 */
function upsertItem(items, name, value) {
  const list = items || [];
  const existing = list.find((i) => i.$?.name === name);
  if (existing) {
    existing._ = value;
    return list;
  }
  list.push({ $: { name }, _: value });
  return list;
}

function ensureStyle(styleList, name, parent) {
  let style = styleList.find((s) => s.$?.name === name);
  if (!style) {
    style = { $: { name, parent }, item: [] };
    styleList.push(style);
  }
  style.item = style.item || [];
  return style;
}

function disableAndroid15TextMetrics(styles) {
  const { resources } = styles;
  const styleList = resources.style || [];

  const appTheme = styleList.find((s) => s.$?.name === 'AppTheme');
  if (!appTheme) {
    throw new Error(`[${TAG}] AppTheme not found in styles.xml`);
  }
  appTheme.item = appTheme.item || [];

  const editTextStyle = ensureStyle(
    styleList,
    EDIT_TEXT_STYLE,
    'Widget.AppCompat.EditText',
  );
  editTextStyle.item = upsertItem(
    editTextStyle.item,
    'android:elegantTextHeight',
    'false',
  );
  // 关掉「按 Locale 预留最小行高」——这才是光标比中文更高的主因
  editTextStyle.item = upsertItem(
    editTextStyle.item,
    'android:useLocalePreferredLineHeightForMinimum',
    'false',
  );

  const textViewStyle = ensureStyle(
    styleList,
    TEXT_VIEW_STYLE,
    'Widget.AppCompat.TextView',
  );
  textViewStyle.item = upsertItem(
    textViewStyle.item,
    'android:elegantTextHeight',
    'false',
  );

  appTheme.item = upsertItem(
    appTheme.item,
    'android:elegantTextHeight',
    'false',
  );
  appTheme.item = upsertItem(
    appTheme.item,
    'editTextStyle',
    `@style/${EDIT_TEXT_STYLE}`,
  );
  appTheme.item = upsertItem(
    appTheme.item,
    'android:editTextStyle',
    `@style/${EDIT_TEXT_STYLE}`,
  );
  appTheme.item = upsertItem(
    appTheme.item,
    'android:textViewStyle',
    `@style/${TEXT_VIEW_STYLE}`,
  );

  resources.style = styleList;
  return styles;
}

function withDisableElegantTextHeight(config) {
  return withAndroidStyles(config, (config) => {
    config.modResults = disableAndroid15TextMetrics(config.modResults);
    return config;
  });
}

module.exports = createRunOncePlugin(
  withDisableElegantTextHeight,
  'withDisableElegantTextHeight',
  '1.1.0',
);
