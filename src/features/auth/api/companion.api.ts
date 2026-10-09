import { apiClient } from '@/core/network/api-client';
import type { UserDetailResponse } from '@/types/companion';

export async function fetchUserDetail(
  userId: string,
  token: string,
): Promise<UserDetailResponse> {
  return apiClient<UserDetailResponse>('/companion/public/detail', {
    method: 'POST',
    body: { userId },
    token,
  });
}
