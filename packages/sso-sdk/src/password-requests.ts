import { md5 } from "./md5.ts";

export type PasswordRequest = {
  path: string;
  data: Record<string, string>;
};

export function createPasswordLoginRequest(
  username: string,
  password: string,
): PasswordRequest {
  return {
    path: "/api/auth/oauth2/token",
    data: {
      grant_type: "password",
      username,
      password: md5(password),
      scope: "openid",
    },
  };
}

export function createForgetPasswordRequest(
  phone: string,
  smsCode: string,
  password: string,
): PasswordRequest {
  return {
    path: "/api/auth/public/common/forget-password",
    data: { phone, smsCode, password: md5(password) },
  };
}
