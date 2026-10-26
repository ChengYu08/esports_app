export type ClientApiResponse<T> = {
  success: boolean;
  code: string;
  info?: string;
  data: T;
};

export type ClientLoginResult = { token: string; register: boolean };

export type ClientUserInfo = {
  id: number;
  nickname: string;
  headImage: string;
  phone?: string;
  gender?: number;
  birth?: string;
  signature?: string;
  isRealName?: number;
  realName?: string;
  idCardNo?: string;
  clubInfo?: { id: number; clubName: string; logoUrl: string; status: number; memberStatus: number } | null;
  positions?: { code: string; description: string }[];
  starBalance?: number | string;
};

export type ClientProfileUpdate = {
  nickname?: string;
  headImage?: string;
  gender?: number;
  birth?: string;
  signature?: string;
};

export type ClientOssSts = {
  endpoint: string;
  bucketName: string;
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  regionId: string;
  domain: string;
  objectList?: string[];
};

export type ClientImToken = { token: string };
export type ClientUserProfile = { id: string; nickname: string; headImage: string };

export type AuthRequestOptions = {
  method: 'POST';
  body?: unknown;
  token?: string;
  /** H5 client endpoints require the legacy PZ signature headers. */
  signed?: boolean;
};

export type AuthRequester = <T>(path: string, options?: AuthRequestOptions) => Promise<ClientApiResponse<T>>;

function unwrap<T>(response: ClientApiResponse<T>): T {
  if (!response.success || response.code !== 'SUCCESS') throw new Error(response.info || '请求失败');
  return response.data;
}

// 数据类端点：后端成功包络可能省略 data，缺失时不能把 undefined 当业务数据返回。
function requireData<T>(response: ClientApiResponse<T>): T {
  const data = unwrap(response);
  if (data === undefined || data === null) throw new Error('响应数据缺失，请稍后重试');
  return data;
}

export function createClientAuthContract(requester: AuthRequester) {
  return {
    async exchangeIdToken(idToken: string, registerWay = 'SMS_CODE') {
      return requireData(await requester<ClientLoginResult>('/client/v1/user/public/login/idtoken', {
        method: 'POST', body: { action: { idToken, registerWay } },
      }));
    },
    async fetchCurrentUser(token: string) {
      return requireData(await requester<ClientUserInfo>('/client/v1/user/login/info', {
        method: 'POST', token,
      }));
    },
    async updateProfile(token: string, data: ClientProfileUpdate) {
      return requireData(await requester<ClientUserInfo>('/client/v1/user/update/profile', {
        method: 'POST', token, body: { action: data },
      }));
    },
    async getOssSts(token: string, bizType: string, objectNames: string[]) {
      return requireData(await requester<ClientOssSts>('/client/v1/oss/sts', {
        method: 'POST', token, body: { action: { bizType, objectNames } },
      }));
    },
    async realNameVerify(token: string, data: { name: string; num: string }) {
      return unwrap(await requester<unknown>('/client/v1/user/elementSmartVerify', {
        method: 'POST', token, body: { action: data },
      }));
    },
    async logout(token: string) {
      return unwrap(await requester<unknown>('/client/v1/user/logout', {
        method: 'POST', token,
      }));
    },
    async checkAccountCancellation(token: string) {
      await unwrap(await requester<unknown>('/client/v1/user/cancellation/apply', {
        method: 'POST', token,
      }));
      return [];
    },
    async sendAccountCancellationSms(token: string) {
      return unwrap(await requester<unknown>('/client/v1/user/cancellation/sms/send', {
        method: 'POST', token,
      }));
    },
    async cancelAccount(token: string, smsCode: string) {
      return unwrap(await requester<unknown>('/client/v1/user/cancellation/verify', {
        method: 'POST', token,
        body: { action: { code: smsCode } },
      }));
    },
    async getImToken(token: string) {
      return requireData(await requester<ClientImToken>('/client/v1/im/token', {
        method: 'POST', token,
      }));
    },
    async getUserProfile(token: string, userId: string) {
      return requireData(await requester<ClientUserProfile>(`/client/v1/user/profile/${encodeURIComponent(userId)}`, {
        method: 'POST', token,
      }));
    },
    async getUserOnlineStatus(token: string, userIds: string[]) {
      return requireData(await requester<Record<string, number>>('/client/v1/user/profile/online-status', {
        method: 'POST', token, body: userIds,
      }));
    },
  };
}
