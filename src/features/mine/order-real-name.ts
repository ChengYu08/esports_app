const COMPANION_REAL_NAME_REQUIRED_MESSAGE = "陪玩未进行实名认证";

export function requiresRealNameVerification(message: string) {
  return message.includes(COMPANION_REAL_NAME_REQUIRED_MESSAGE);
}
