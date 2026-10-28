import { useAuthStore } from "@esports/auth";

import { clientAuthApi } from "@/features/auth/client-auth.api";
import { toAuthUser } from "@/features/auth/client-auth-flow";
import { saveAuthSession } from "@/features/auth/session-persistence";

export async function submitRealNameVerification(params: {
  token: string;
  name: string;
  idCard: string;
  phone?: string;
}) {
  await clientAuthApi.realNameVerify(params.token, {
    name: params.name,
    num: params.idCard,
  });
  const profile = await clientAuthApi.fetchCurrentUser(params.token);
  const session = {
    accessToken: params.token,
    user: toAuthUser(profile, params.phone),
  };
  await saveAuthSession(session);
  useAuthStore.getState().setSession(session);
}
