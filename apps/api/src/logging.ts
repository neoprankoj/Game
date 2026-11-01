import type { FastifyServerOptions } from 'fastify';

/**
 * pino options (ADR-0010): JSON logs, request id on every line, secrets and PII redacted. URLs are logged
 * without query strings (tokens can appear there); client IPs are not logged.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["idempotency-key"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.token',
  '*.email',
  '*.secret',
];

type LoggerOptions = Exclude<NonNullable<FastifyServerOptions['logger']>, boolean>;

export function loggerOptions(level: string, pretty: boolean): LoggerOptions {
  return {
    level,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    serializers: {
      // requestId is already on every line (logController label); never log query strings or client IPs.
      req: (req: { method: string; url: string }) => ({ method: req.method, path: req.url.split('?')[0] }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    ...(pretty ? { transport: { target: 'pino-pretty', options: { translateTime: 'UTC:HH:MM:ss.l' } } } : {}),
  };
}
