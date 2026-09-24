import Constants from 'expo-constants';
import { env } from '@/core/config/env';

type LogContext = Record<string, string | number | boolean | null | undefined>;
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const sensitiveKeys = /token|password|secret|authorization|phone|email/i;

function redact(context: LogContext = {}) {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, sensitiveKeys.test(key) ? '[REDACTED]' : value]),
  );
}

function write(level: LogLevel, message: string, context?: LogContext) {
  if (env.environment === 'production' && level === 'debug') return;
  const payload = { level, message, version: Constants.expoConfig?.version, ...redact(context) };
  console[level === 'debug' ? 'log' : level](JSON.stringify(payload));
}

export const logger = {
  debug: (message: string, context?: LogContext) => write('debug', message, context),
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, context?: LogContext) => write('error', message, context),
};
