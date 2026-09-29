import { secureStorage } from '@/core/storage/storage';
import {
  clearPersistedAuthSession,
  readPersistedAuthSession,
  savePersistedAuthSession,
  type PersistedAuthSession,
} from './session-contract';

export type AuthSession = PersistedAuthSession;

export const readAuthSession = () => readPersistedAuthSession(secureStorage);
export const saveAuthSession = (session: AuthSession) => savePersistedAuthSession(session, secureStorage);
export const clearAuthSession = () => clearPersistedAuthSession(secureStorage);
