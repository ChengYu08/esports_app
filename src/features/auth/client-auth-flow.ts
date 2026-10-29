import type { SsoToken } from '@esports/sso-sdk';
import type { AuthUser } from '@esports/auth';
import { clientAuthApi, type ClientUserInfo } from './client-auth.api';
import { saveAuthSession } from './session-persistence';
import { fetchUserDetail } from './api/companion.api';
import { logger } from '@/core/logging/logger';
import type { CompanionProfile } from '@/types/companion';
import { resolveAuthPhone } from './auth-phone';

type SetSession = (session: { accessToken: string; user: AuthUser }) => void;
type SetCompanionStatus = (isCompanion: boolean, profile: CompanionProfile | null) => void;

// 本次启动是否发生过登录：青少年模式促销弹窗"完成登录后的下次启动才弹"依赖此标记。
let loginThisLaunch = false;

/** 本次启动内是否完成过登录。 */
export function didLoginThisLaunch(): boolean {
  return loginThisLaunch;
}

export function toAuthUser(profile: ClientUserInfo, fallbackPhone?: string): AuthUser {
  return {
    id: String(profile.id),
    nickname: profile.nickname,
    headImage: profile.headImage,
    phone: resolveAuthPhone(profile.phone, fallbackPhone),
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
  setCompanionStatus?: SetCompanionStatus,
  fallbackPhone?: string,
) {
  if (!ssoToken.id_token) throw new Error('统一登录未返回 idToken');
  const login = await clientAuthApi.exchangeIdToken(ssoToken.id_token, registerWay);
  if (!login.token) throw new Error('业务 token 为空');
  const profile = await clientAuthApi.fetchCurrentUser(login.token);
  const session = { accessToken: login.token, user: toAuthUser(profile, fallbackPhone ?? ssoToken.phone) };
  await saveAuthSession(session);
  setSession(session);
  loginThisLaunch = true;

  // 检查陪玩身份
  if (setCompanionStatus) {
    try {
      const userDetail = await fetchUserDetail(String(profile.id), login.token);
      const isCompanion = profile.positions?.some((position) => position.code === 'COMPANION') ?? false;
      setCompanionStatus(isCompanion, userDetail.companionProfile ?? null);
      logger.debug('companion.status_checked', { userId: profile.id, isCompanion });
    } catch (error) {
      logger.warn('companion.status_check_failed', {
        userId: profile.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { login, profile };
}
