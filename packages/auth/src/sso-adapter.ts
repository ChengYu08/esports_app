import type { SsoClient } from "@esports/sso-sdk";
import type { LoginPayload, PasswordLoginPayload } from "./LoginScreen";

export type ForgotPasswordPayload = {
  phone: string;
  code: string;
  password: string;
};

export function createAuthSsoAdapter(client: SsoClient) {
  return {
    sendCode: async (phone: string) => { await client.getSmsCode(phone); },
    login: (payload: LoginPayload) => client.smsLogin(payload.phone, payload.code),
    passwordLogin: (payload: PasswordLoginPayload) =>
      client.passwordLogin(payload.username, payload.password),
    sendResetCode: async (phone: string) => {
      await client.getSmsCode(phone, "MOD");
    },
    forgetPassword: (payload: ForgotPasswordPayload) =>
      client.forgetPassword(payload.phone, payload.code, payload.password),
    quickLogin: (provider: Parameters<SsoClient["quickLogin"]>[0]) => client.quickLogin(provider),
  };
}
