import { pino, type Logger } from 'pino';

/** Same redaction policy as the API (ADR-0010): no secrets or PII in logs. */
const REDACT_PATHS = ['*.password', '*.token', '*.email', '*.secret', '*.authorization', '*.cookie'];

export function createLogger(level: string, pretty: boolean): Logger {
  return pino({
    level,
    base: { service: 'workers' },
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    ...(pretty ? { transport: { target: 'pino-pretty', options: { translateTime: 'UTC:HH:MM:ss.l' } } } : {}),
  });
}
