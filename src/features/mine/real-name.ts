const FULLWIDTH_DIGITS = /[\uFF10-\uFF19]/g;

export function normalizeIdCard(value: string) {
  return value
    .replace(FULLWIDTH_DIGITS, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0),
    )
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function isValidIdCard(value: string) {
  return /^\d{17}[\dX]$/.test(value);
}

export function canSubmitRealName(name: string, idCard: string) {
  return Boolean(name.trim()) && isValidIdCard(normalizeIdCard(idCard));
}

export function realNameFailureMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "认证失败，请稍后重试";
}
