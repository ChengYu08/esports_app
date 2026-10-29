export type TeenModeRecord = {
  enabled: boolean;
  password: string;
};

export const TEEN_MODE_PASSWORD_LENGTH = 4;

export function filterDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, TEEN_MODE_PASSWORD_LENGTH);
}

export function isPasswordComplete(value: string) {
  return new RegExp(`^\\d{${TEEN_MODE_PASSWORD_LENGTH}}$`).test(value);
}

export function isPasswordMatch(first: string, second: string) {
  return isPasswordComplete(first) && first === second;
}
