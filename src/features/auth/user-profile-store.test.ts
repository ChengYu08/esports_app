import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clientAuthApi } from '@/features/auth/client-auth.api';

import { useUserProfileStore } from './user-profile-store';

vi.mock('@/features/auth/client-auth.api', () => ({
  clientAuthApi: { getUserProfiles: vi.fn() },
}));

const getUserProfiles = vi.mocked(clientAuthApi.getUserProfiles);

const profile = (id: string, nickname = `昵称${id}`) => ({
  id,
  nickname,
  headImage: `https://h/${id}.png`,
});

describe('user profile store', () => {
  beforeEach(() => {
    vi.useRealTimers();
    getUserProfiles.mockReset();
    useUserProfileStore.getState().reset();
  });

  it('fetches missing profiles in one batch call and caches them', async () => {
    getUserProfiles.mockResolvedValue([profile('1'), profile('2')]);

    const fetched = await useUserProfileStore.getState().hydrateProfiles(['1', '2'], 'token');

    expect(fetched.map((item) => item.id)).toEqual(['1', '2']);
    expect(getUserProfiles).toHaveBeenCalledTimes(1);
    expect(getUserProfiles).toHaveBeenCalledWith('token', ['1', '2']);
    const { cached, missing } = useUserProfileStore.getState().splitByCache(['1', '2']);
    expect(cached.map((item) => item.id)).toEqual(['1', '2']);
    expect(missing).toEqual([]);
    expect(useUserProfileStore.getState().getCached('1')?.nickname).toBe('昵称1');
  });

  it('skips cached ids on later hydrates and makes no request when all hit cache', async () => {
    getUserProfiles.mockResolvedValue([profile('1')]);
    await useUserProfileStore.getState().hydrateProfiles(['1'], 'token');
    getUserProfiles.mockClear();

    await useUserProfileStore.getState().hydrateProfiles(['1'], 'token');

    expect(getUserProfiles).not.toHaveBeenCalled();
  });

  it('refetches after the cache TTL expires', async () => {
    vi.useFakeTimers();
    getUserProfiles.mockResolvedValue([profile('1')]);
    await useUserProfileStore.getState().hydrateProfiles(['1'], 'token');
    getUserProfiles.mockClear();

    vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1000);
    getUserProfiles.mockResolvedValue([profile('1', '新昵称1')]);
    const fetched = await useUserProfileStore.getState().hydrateProfiles(['1'], 'token');

    expect(getUserProfiles).toHaveBeenCalledWith('token', ['1']);
    expect(fetched[0]?.nickname).toBe('新昵称1');
    expect(useUserProfileStore.getState().getCached('1')?.nickname).toBe('新昵称1');
  });

  it('dedupes concurrent hydrates for the same id into a single request', async () => {
    let resolveBatch: (value: Awaited<ReturnType<typeof getUserProfiles>>) => void = () => undefined;
    getUserProfiles.mockImplementation(
      () => new Promise((resolve) => {
        resolveBatch = resolve;
      }),
    );

    const first = useUserProfileStore.getState().hydrateProfiles(['1'], 'token');
    const second = useUserProfileStore.getState().hydrateProfiles(['1'], 'token');
    resolveBatch([profile('1')]);
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(getUserProfiles).toHaveBeenCalledTimes(1);
    expect(firstResult.map((item) => item.id)).toEqual(['1']);
    expect(secondResult).toEqual([]);
    expect(useUserProfileStore.getState().isFetching('1')).toBe(false);
  });

  it('does not cache failed batches and clears inflight for retry', async () => {
    getUserProfiles.mockRejectedValue(new Error('网络失败'));

    const fetched = await useUserProfileStore.getState().hydrateProfiles(['1'], 'token');

    expect(fetched).toEqual([]);
    expect(useUserProfileStore.getState().getCached('1')).toBeUndefined();
    expect(useUserProfileStore.getState().isFetching('1')).toBe(false);

    getUserProfiles.mockResolvedValue([profile('1')]);
    await useUserProfileStore.getState().hydrateProfiles(['1'], 'token');
    expect(useUserProfileStore.getState().getCached('1')?.nickname).toBe('昵称1');
  });

  it('chunks large id lists into batches of 50', async () => {
    const ids = Array.from({ length: 120 }, (_, index) => String(index + 1));
    getUserProfiles.mockImplementation((_token, batch) =>
      Promise.resolve(batch.map((id) => profile(id))),
    );

    const fetched = await useUserProfileStore.getState().hydrateProfiles(ids, 'token');

    expect(getUserProfiles).toHaveBeenCalledTimes(3);
    expect(getUserProfileBatches()).toEqual([50, 50, 20]);
    expect(fetched).toHaveLength(120);
  });

  it('makes no request for empty ids or missing token', async () => {
    await useUserProfileStore.getState().hydrateProfiles([], 'token');
    await useUserProfileStore.getState().hydrateProfiles(['1'], '');
    expect(getUserProfiles).not.toHaveBeenCalled();
  });

  it('reset clears the cache', async () => {
    getUserProfiles.mockResolvedValue([profile('1')]);
    await useUserProfileStore.getState().hydrateProfiles(['1'], 'token');

    useUserProfileStore.getState().reset();

    expect(useUserProfileStore.getState().getCached('1')).toBeUndefined();
    expect(useUserProfileStore.getState().byId).toEqual({});
  });

  function getUserProfileBatches() {
    return getUserProfiles.mock.calls.map((call) => call[1].length);
  }
});
