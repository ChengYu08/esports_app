import { SsoClient } from "@esports/sso-sdk";
import type { LoginPayload } from "./LoginScreen";

export function createAuthSsoAdapter(client: SsoClient) {
  return {
    sendCode: async (phone: string) => { await client.getSmsCode(phone); },
    login: (payload: LoginPayload) => client.smsLogin(payload.phone, payload.code),
    quickLogin: (provider: Parameters<SsoClient["quickLogin"]>[0]) => client.quickLogin(provider),
  };
}
