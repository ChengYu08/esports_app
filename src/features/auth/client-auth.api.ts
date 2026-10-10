import { Platform } from 'react-native';
import Constants from 'expo-constants';
import CryptoJS from 'crypto-js';
import { apiClient, type RequestOptions } from '@/core/network/api-client';
import { createClientAuthContract, type AuthRequestOptions, type AuthRequester, type ClientApiResponse } from './client-auth.contract';

const encodeForSign = (value: string) => encodeURIComponent(value).replace(/[*!'~()]/g, (character) =>
  `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
);

const createH5SignatureHeaders = (body: unknown): Record<string, string> => {
  const timestamp = Date.now();
  const random = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  const material = `PZTimestamp=${timestamp}&Random=${random}&2147483647=${encodeForSign(JSON.stringify(body ?? {}))}&accessKey=3qXyB7uf`;
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'H5';
  const os = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'H5';
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    PZVersion: version,
    PZPlatform: platform,
    PZOs: os,
    PZTimestamp: String(timestamp),
    Random: random,
    Skey: 'CLIENT',
    sign: CryptoJS.MD5(material).toString(),
  };
};

const request: AuthRequester = <T>(path: string, options?: AuthRequestOptions) => {
  const authOptions = options ?? { method: 'POST' as const };
  const { signed, body, ...requestOptions } = authOptions;
  return apiClient<ClientApiResponse<T>>(path, {
    ...requestOptions,
    body,
    ...(signed ? { headers: createH5SignatureHeaders(body) } : {}),
  } as RequestOptions);
};

export const createClientAuthApi = (requester: AuthRequester = request) => createClientAuthContract(requester);
export const clientAuthApi = createClientAuthApi();
export type { ClientApiResponse, ClientLoginResult, ClientUserInfo, ClientProfileUpdate, ClientOssSts, ClientImToken, ClientUserProfile } from './client-auth.contract';
