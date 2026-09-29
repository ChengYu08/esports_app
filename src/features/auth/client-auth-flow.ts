import type { SsoToken } from '@esports/sso-sdk';
import type { AuthUser } from '@esports/auth';
import { clientAuthApi, type ClientUserInfo } from './client-auth.api';

type SetSession = (session: { accessToken: string; user: AuthUser }) => void;

function toAuthUser(profile: ClientUserInfo, fallbackPhone?: string): AuthUser {
  return {
    id: String(profile.id),
    nickname: profile.nickname,
    headImage: profile.headImage,
    phone: profile.phone ?? fallbackPhone,
    gender: profile.gender,
    birth: profile.birth,
    signature: profile.signature,
    isRealName: profile.isRealName,
    realName: profile.realName,
    idCardNo: profile.idCardNo,
    clubInfo: profile.clubInfo,
    positions: profile.positions,
    starBalance: profile.starBalance,
  };
}

export async function completeClientLogin(
  ssoToken: SsoToken & { phone?: string },
  registerWay: string,
  setSession: SetSession,
) {
  if (!ssoToken.id_token) throw new Error('统一登录未返回 idToken');
  const login = await clientAuthApi.exchangeIdToken(ssoToken.id_token, registerWay);
  if (!login.token) throw new Error('业务 token 为空');
  const profile = await clientAuthApi.fetchCurrentUser(login.token);
  setSession({ accessToken: login.token, user: toAuthUser(profile, ssoToken.phone) });
  return { login, profile };
}
