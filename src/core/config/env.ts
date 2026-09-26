import Constants from 'expo-constants';
import { z } from 'zod';

const envSchema = z.object({
  apiBaseUrl: z.string().url().default('https://api.example.com'),
  environment: z.enum(['development', 'preview', 'production']).default('development'),
  ssoClientAppId: z.string().default('android'),
  ssoClientSecret: z.string().default(''),
});

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

export const env = envSchema.parse({
  apiBaseUrl: extra.apiBaseUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL,
  environment: extra.environment ?? process.env.EXPO_PUBLIC_ENVIRONMENT,
  ssoClientAppId: extra.ssoClientAppId ?? process.env.EXPO_PUBLIC_SSO_CLIENT_APP_ID,
  ssoClientSecret: extra.ssoClientSecret ?? process.env.EXPO_PUBLIC_SSO_CLIENT_SECRET,
});
