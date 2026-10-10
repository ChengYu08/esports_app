const FULL_MAINLAND_PHONE_PATTERN = /^1\d{10}$/;

export function isFullMainlandPhone(phone?: string): phone is string {
  return typeof phone === "string" && FULL_MAINLAND_PHONE_PATTERN.test(phone);
}

export function resolveAuthPhone(profilePhone?: string, fallbackPhone?: string) {
  if (isFullMainlandPhone(profilePhone)) return profilePhone;
  if (isFullMainlandPhone(fallbackPhone)) return fallbackPhone;
  return profilePhone;
}
