import { env } from "@/core/config/env";

/**
 * App-level links that may change independently from the app code.
 * Protocol pages are hosted on PC; content is managed server-side by code.
 */
export const APP_LINKS = {
  userAgreement: `${env.protocolBaseUrl}/public/protocols?code=user_server`,
  privacyPolicy: `${env.protocolBaseUrl}/public/protocols?code=user_privacy`,
} as const;
