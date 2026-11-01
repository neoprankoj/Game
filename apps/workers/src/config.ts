import { z } from 'zod';

const WorkersEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  REDIS_URL: z.string().regex(/^rediss?:\/\/.+/, 'must be a redis:// URL'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Redis key prefix for all queues (keys look like `chronos:timed-actions:…`). */
  QUEUE_PREFIX: z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,30}$/)
    .default('chronos'),
  /** Jobs processed in parallel per queue by this process. */
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(5),
  /** How often the reconciler sweeps for overdue timed actions (Part 3.5: 30–60 s). */
  RECONCILER_INTERVAL_MS: z.coerce.number().int().min(1000).default(30_000),
  /** Time to finish in-flight jobs on SIGTERM before forcing exit. */
  WORKER_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
});

export type WorkersConfig = z.output<typeof WorkersEnv>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkersConfig {
  const parsed = WorkersEnv.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid workers environment (see .env.example):\n${problems}`);
  }
  return parsed.data;
}
