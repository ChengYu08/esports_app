import { apiClient, type RequestOptions } from '@/core/network/api-client';
import { createClientAuthContract, type AuthRequestOptions, type AuthRequester, type ClientApiResponse } from './client-auth.contract';

const request: AuthRequester = <T>(path: string, options?: AuthRequestOptions) =>
  apiClient<ClientApiResponse<T>>(path, options as RequestOptions);

export const createClientAuthApi = (requester: AuthRequester = request) => createClientAuthContract(requester);
export const clientAuthApi = createClientAuthApi();
export type { ClientApiResponse, ClientLoginResult, ClientUserInfo, ClientProfileUpdate } from './client-auth.contract';
