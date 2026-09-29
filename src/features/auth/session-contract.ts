export type PersistedAuthSession = { accessToken: string; user: { id: string; [key: string]: unknown } };

export type SessionStorage = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

export const SESSION_KEY = 'esports.auth.session';

const isAuthSession = (value: unknown): value is PersistedAuthSession =>
  Boolean(value)
  && typeof value === 'object'
  && typeof (value as PersistedAuthSession).accessToken === 'string'
  && Boolean((value as PersistedAuthSession).accessToken)
  && typeof (value as PersistedAuthSession).user?.id === 'string';

export async function readPersistedAuthSession(storage: SessionStorage): Promise<PersistedAuthSession | null> {
  const value = await storage.get(SESSION_KEY);
  if (!value) return null;
  try {
    const session: unknown = JSON.parse(value);
    return isAuthSession(session) ? session : null;
  } catch {
    return null;
  }
}

export async function savePersistedAuthSession(session: PersistedAuthSession, storage: SessionStorage) {
  await storage.set(SESSION_KEY, JSON.stringify(session));
}

export async function clearPersistedAuthSession(storage: SessionStorage) {
  await storage.remove(SESSION_KEY);
}
