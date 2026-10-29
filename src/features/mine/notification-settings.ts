import { storage } from "@/core/storage/storage";

export type NotificationSettings = {
  doNotDisturbEnabled: boolean;
};

const NOTIFICATION_SETTINGS_STORAGE_KEY = "esports.mine.notification-settings";
const QUIET_HOURS_START_HOUR = 23;
const QUIET_HOURS_END_HOUR = 6;

const DEFAULT_SETTINGS: NotificationSettings = { doNotDisturbEnabled: false };

let cachedSettings: NotificationSettings = DEFAULT_SETTINGS;
let loadPromise: Promise<void> | null = null;

/** 预加载缓存，供消息模块同步判断免打扰状态使用。 */
export function ensureNotificationSettingsLoaded(): Promise<void> {
  loadPromise ??= (async () => {
    cachedSettings = parseNotificationSettings(
      await storage.get(NOTIFICATION_SETTINGS_STORAGE_KEY),
    );
  })();
  return loadPromise;
}

export function parseNotificationSettings(value: string | null): NotificationSettings {
  if (!value) return DEFAULT_SETTINGS;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return DEFAULT_SETTINGS;
    const settings = parsed as Partial<NotificationSettings>;
    return { doNotDisturbEnabled: settings.doNotDisturbEnabled === true };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function readNotificationSettings(): Promise<NotificationSettings> {
  await ensureNotificationSettingsLoaded();
  return cachedSettings;
}

export async function saveDoNotDisturbEnabled(
  enabled: boolean,
): Promise<NotificationSettings> {
  cachedSettings = { ...cachedSettings, doNotDisturbEnabled: enabled };
  await storage.set(
    NOTIFICATION_SETTINGS_STORAGE_KEY,
    JSON.stringify(cachedSettings),
  );
  return cachedSettings;
}

export function isQuietHours(date: Date): boolean {
  const hour = date.getHours();
  return hour >= QUIET_HOURS_START_HOUR || hour < QUIET_HOURS_END_HOUR;
}

/** 消息免打扰开启时，23:00～6:00 不弹新消息提醒。 */
export function isMessageNotificationMuted(date: Date = new Date()): boolean {
  return cachedSettings.doNotDisturbEnabled && isQuietHours(date);
}
