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

export type AuthRequestOptions = {
  method: 'POST';
  body?: unknown;
  token?: string;
};

export type AuthRequester = <T>(path: string, options?: AuthRequestOptions) => Promise<ClientApiResponse<T>>;

function unwrap<T>(response: ClientApiResponse<T>): T {
  if (!response.success || response.code !== 'SUCCESS') throw new Error(response.info || '请求失败');
  return response.data;
}

export function createClientAuthContract(requester: AuthRequester) {
  return {
    async exchangeIdToken(idToken: string, registerWay = 'SMS_CODE') {
      return unwrap(await requester<ClientLoginResult>('/client/v1/user/public/login/idtoken', {
        method: 'POST', body: { action: { idToken, registerWay } },
      }));
    },
    async fetchCurrentUser(token: string) {
      return unwrap(await requester<ClientUserInfo>('/client/v1/user/login/info', {
        method: 'POST', token,
      }));
    },
    async updateProfile(token: string, data: ClientProfileUpdate) {
      return unwrap(await requester<ClientUserInfo>('/client/v1/user/update/profile', {
        method: 'POST', token, body: { action: data },
      }));
    },
    async getOssSts(token: string, bizType: string, objectNames: string[]) {
      return unwrap(await requester<ClientOssSts>('/client/v1/oss/sts', {
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
  };
}
