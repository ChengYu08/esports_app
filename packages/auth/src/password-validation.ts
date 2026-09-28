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
