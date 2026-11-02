import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const csv = z.string().transform((v) =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
);

const ApiEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().min(1).default('127.0.0.1'),
  /** Hosting platforms (Railway) inject PORT; API_PORT wins when both are set. */
  API_PORT: z.coerce.number().int().min(0).max(65535).optional(),
  PORT: z.coerce.number().int().min(0).max(65535).optional(),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\/.+/, 'must be a postgres:// URL'),
  REDIS_URL: z.string().regex(/^rediss?:\/\/.+/, 'must be a redis:// URL'),
  /** Exact browser origins allowed by CORS (the web client). Comma-separated. */
  CORS_ORIGINS: csv.default([]),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Basic global limit per client IP (hardened per category in 11.2). */
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  /** true behind the hosting platform's proxy so request.ip is the real client (rate limiting). */
  TRUST_PROXY: bool.default(false),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  /** Signs session cookies and tokens (Better Auth). ≥ 32 random characters; unique per environment. */
  BETTER_AUTH_SECRET: z.string().min(32, 'must be at least 32 characters (openssl rand -base64 32)'),
  /** Public base URL of THIS API as clients reach it (links in emails, cookie security). */
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
  /** Per-IP limits on sign-in/sign-up/reset (Part 2.8 basic; hardened in 11.2). Off only in local E2E runs. */
  AUTH_RATE_LIMIT: bool.default(true),
  /** How account emails are delivered. Only the local dev mailbox exists until a provider is chosen (2.10). */
  MAIL_TRANSPORT: z.enum(['dev-file']).default('dev-file'),
  /** dev-file transport: JSON-lines file every email is appended to (git-ignored). */
  MAIL_DEV_OUTBOX: z.string().min(1).default('.data/dev-mailbox.jsonl'),
  MAIL_FROM: z.string().min(3).default('Chronos Cradle <no-reply@localhost>'),
});

/** Mail transports that only work on a developer machine (refused in production). */
const DEV_ONLY_MAIL_TRANSPORTS: ReadonlySet<string> = new Set(['dev-file']);

/** The value shipped in .env.example: fine on a laptop, refused in production. */
export const EXAMPLE_AUTH_SECRET = 'local-dev-only-secret-change-me-0123456789';

export interface ApiConfig {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  corsOrigins: readonly string[];
  logLevel: string;
  rateLimit: { max: number; windowMs: number };
  trustProxy: boolean;
  shutdownTimeoutMs: number;
  auth: AuthConfig;
  mail: MailConfig;
}

export interface AuthConfig {
  secret: string;
  baseUrl: string;
  rateLimit: boolean;
}

export interface MailConfig {
  transport: 'dev-file';
  devOutboxPath: string;
  from: string;
}

/** Validates the environment at startup (CLAUDE.md §8). Fails fast with every problem listed. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = ApiEnv.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid API environment (see .env.example):\n${problems}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (e.BETTER_AUTH_SECRET === EXAMPLE_AUTH_SECRET)
      problems.push('BETTER_AUTH_SECRET: the example value is not allowed in production');
    if (!e.BETTER_AUTH_URL.startsWith('https://'))
      problems.push('BETTER_AUTH_URL: must be https in production (secure cookies)');
    if (DEV_ONLY_MAIL_TRANSPORTS.has(e.MAIL_TRANSPORT))
      problems.push(
        'MAIL_TRANSPORT: the dev mailbox would silently swallow verification and reset emails; configure a real provider (Part 2.10)',
      );
    if (!e.AUTH_RATE_LIMIT) problems.push('AUTH_RATE_LIMIT: must stay on in production');
    if (problems.length > 0)
      throw new Error(`Invalid API environment for production:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  }
  return {
    env: e.NODE_ENV,
    host: e.API_HOST,
    port: e.API_PORT ?? e.PORT ?? 3000,
    databaseUrl: e.DATABASE_URL,
    redisUrl: e.REDIS_URL,
    corsOrigins: e.CORS_ORIGINS,
    logLevel: e.LOG_LEVEL,
    rateLimit: { max: e.RATE_LIMIT_MAX, windowMs: e.RATE_LIMIT_WINDOW_MS },
    trustProxy: e.TRUST_PROXY,
    shutdownTimeoutMs: e.SHUTDOWN_TIMEOUT_MS,
    auth: {
      secret: e.BETTER_AUTH_SECRET,
      baseUrl: e.BETTER_AUTH_URL.replace(/\/$/, ''),
      rateLimit: e.AUTH_RATE_LIMIT,
    },
    mail: { transport: e.MAIL_TRANSPORT, devOutboxPath: e.MAIL_DEV_OUTBOX, from: e.MAIL_FROM },
  };
}
