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
});

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
}

/** Validates the environment at startup (CLAUDE.md §8). Fails fast with every problem listed. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = ApiEnv.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid API environment (see .env.example):\n${problems}`);
  }
  const e = parsed.data;
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
  };
}
