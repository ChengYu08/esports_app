const MAINLAND_PHONE_PATTERN = /^1\d{10}$/;
const SPECIAL_PASSWORD_PATTERN = /[%&@#!$^*()_+\-=[\]{};':"\\|,.<>/?]/;

export function sanitizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function sanitizeCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function validatePhone(phone: string): string | null {
  if (!phone) return "请输入手机号";
  if (!MAINLAND_PHONE_PATTERN.test(phone)) return "请输入正确的手机号";
  return null;
}

export function isLoginFormReady(
  mode: "sms" | "password",
  phone: string,
  credential: string,
): boolean {
  if (validatePhone(phone)) return false;
  return mode === "password" ? credential.length > 0 : /^\d{6}$/.test(credential);
}

export function getSmsCodeActionLabel(
  isSending: boolean,
  countdown: number,
): string {
  if (isSending) return "发送中...";
  if (countdown > 0) return `重新获取(${countdown}s)`;
  return "获取验证码";
}

export function canSendSmsCode(
  phone: string,
  isSending: boolean,
  countdown: number,
): boolean {
  return !validatePhone(phone) && !isSending && countdown <= 0;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8 || password.length > 16) {
    return "密码长度为8-16位";
  }
  if (/\s/.test(password)) return "密码不允许有空格";

  const typeCount = [
    SPECIAL_PASSWORD_PATTERN.test(password),
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
  ].filter(Boolean).length;

  if (typeCount < 3) {
    return "密码需包含特殊字符(如:%、&、#等)、大写字母、小写字母、数字中的三种或以上";
  }
  return null;
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | null {
  if (!confirmation) return "请再次输入新密码";
  if (password !== confirmation) return "两次输入的密码不一致";
  return null;
}

export type ForgotPasswordFormValues = {
  phone: string;
  code: string;
  password: string;
  confirmation: string;
};

export function validateForgotPasswordForm(
  values: ForgotPasswordFormValues,
): string | null {
  const phoneError = validatePhone(values.phone);
  if (phoneError) return phoneError;
  if (!values.code) return "请输入验证码";

  const passwordError = validatePassword(values.password);
  if (passwordError) return passwordError;

  return validatePasswordConfirmation(values.password, values.confirmation);
}
