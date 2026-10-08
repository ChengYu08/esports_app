const PASSWORD_LOGIN_ERROR_FALLBACK = "请检查手机号和密码";

export function getPasswordLoginErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : PASSWORD_LOGIN_ERROR_FALLBACK;
}
