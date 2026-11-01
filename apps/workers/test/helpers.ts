import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { pino, type Logger } from 'pino';
import { createRedisConnection } from '../src/redis';

const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (!process.env.REDIS_URL && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export const redisUrl = (): string => {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL missing: run pnpm dev:up and create .env');
  return url;
};

/** Every test gets its own key prefix, so test files never see each other's queues. */
export const testPrefix = (): string => `chronos-test-${randomBytes(4).toString('hex')}`;

export function capturingLogger(): { log: Logger; lines: () => { msg: string; [k: string]: unknown }[] } {
  const raw: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, callback) {
      raw.push(...chunk.toString().split('\n').filter(Boolean));
      callback();
    },
  });
  return {
    log: pino({ level: 'debug' }, stream),
    lines: () => raw.map((l) => JSON.parse(l) as { msg: string }),
  };
}

/** Deletes every key under a test prefix (SCAN, never KEYS on shared instances). */
export async function deletePrefix(prefix: string): Promise<void> {
  const redis = createRedisConnection(redisUrl());
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}:*`, 'COUNT', 500);
    cursor = next;
    if (keys.length) await redis.del(...keys);
  } while (cursor !== '0');
  await redis.quit();
}

export const until = async (condition: () => Promise<boolean>, timeoutMs = 10_000): Promise<void> => {
  const deadline = performance.now() + timeoutMs;
  while (!(await condition())) {
    if (performance.now() > deadline) throw new Error('condition not met in time');
    await new Promise((r) => setTimeout(r, 25));
  }
};
