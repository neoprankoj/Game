import { Redis } from 'ioredis';
import type { Logger } from 'pino';

/** BullMQ requires `maxRetriesPerRequest: null` for blocking worker connections (ADR-0008). */
export function createRedisConnection(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: null });
}

export type EvictionCheck = 'ok' | 'unverified';

/**
 * ADR-0008: BullMQ needs `maxmemory-policy noeviction`, otherwise Redis may silently evict queued jobs.
 * Fails fast on a wrong policy. Managed services that forbid CONFIG cannot be verified: warn and continue.
 */
export async function assertNoEviction(
  redis: Pick<Redis, 'config'>,
  log: Pick<Logger, 'warn' | 'info'>,
): Promise<EvictionCheck> {
  let reply: unknown;
  try {
    reply = await redis.config('GET', 'maxmemory-policy');
  } catch (error) {
    log.warn({ err: error }, 'cannot read maxmemory-policy (CONFIG disabled?); verify noeviction manually');
    return 'unverified';
  }
  const policy = Array.isArray(reply) ? String(reply[1]) : undefined;
  if (policy !== 'noeviction') {
    throw new Error(
      `Redis maxmemory-policy is "${policy ?? 'unknown'}"; BullMQ requires "noeviction" (ADR-0008)`,
    );
  }
  log.info('redis maxmemory-policy is noeviction');
  return 'ok';
}
