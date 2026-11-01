import type { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineJob, reconcileJob, RECONCILER_SCHEDULER_ID } from '../src/jobs';
import { QUEUES } from '../src/queues';
import { assertNoEviction, createRedisConnection } from '../src/redis';
import { startRuntime } from '../src/runtime';
import { capturingLogger, deletePrefix, redisUrl, testPrefix, until } from './helpers';

let connection: Redis;
const prefixes: string[] = [];
beforeAll(() => {
  connection = createRedisConnection(redisUrl());
});
afterAll(async () => {
  await connection.quit();
  for (const p of prefixes) await deletePrefix(p);
});
const newPrefix = () => {
  const p = testPrefix();
  prefixes.push(p);
  return p;
};

describe('reconciler scheduler', () => {
  it('runs the reconciler periodically and never duplicates the schedule across restarts', async () => {
    const prefix = newPrefix();
    const options = {
      connection,
      prefix,
      jobs: [reconcileJob],
      log: capturingLogger().log,
      concurrency: 1,
      reconcilerIntervalMs: 250,
    };
    const first = await startRuntime(options);
    const queue = first.producer.queue(QUEUES.maintenance);
    await until(async () => (await queue.getCompletedCount()) >= 2, 5000);
    await first.close();
    const second = await startRuntime(options); // a restart upserts the same scheduler
    const schedulers = await second.producer.queue(QUEUES.maintenance).getJobSchedulers();
    expect(schedulers.map((s) => s.key)).toEqual([RECONCILER_SCHEDULER_ID]);
    await second.close();
  });
});

describe('graceful shutdown', () => {
  it('waits for in-flight jobs to finish before closing', async () => {
    const prefix = newPrefix();
    const events: string[] = [];
    const slow = defineJob({
      name: 'test.slow',
      queue: QUEUES.diagnostics,
      payload: z.object({}),
      handler: async () => {
        events.push('job started');
        await new Promise((r) => setTimeout(r, 400));
        events.push('job finished');
        return null;
      },
    });
    const runtime = await startRuntime({
      connection,
      prefix,
      jobs: [slow],
      log: capturingLogger().log,
      concurrency: 1,
      reconcilerIntervalMs: 0,
    });
    const id = await runtime.producer.enqueue(slow, {});
    await until(() => Promise.resolve(events.includes('job started')));
    const check = createRedisConnection(redisUrl());
    await runtime.close();
    events.push('closed');
    expect(events).toEqual(['job started', 'job finished', 'closed']);
    const { Queue } = await import('bullmq');
    const q = new Queue(QUEUES.diagnostics, { connection: check, prefix });
    expect(await (await q.getJob(id))?.getState()).toBe('completed');
    await q.close();
    await check.quit();
  });
});

describe('maxmemory-policy check (ADR-0008)', () => {
  const log = capturingLogger().log;
  it('passes on the local Redis (noeviction)', async () => {
    expect(await assertNoEviction(connection, log)).toBe('ok');
  });

  it('refuses a Redis that may evict queued jobs', async () => {
    const fake = { config: () => Promise.resolve(['maxmemory-policy', 'allkeys-lru']) } as never;
    await expect(assertNoEviction(fake, log)).rejects.toThrow(/noeviction/);
  });

  it('warns but continues when CONFIG is disabled (managed Redis)', async () => {
    const fake = { config: () => Promise.reject(new Error('ERR unknown command CONFIG')) } as never;
    expect(await assertNoEviction(fake, log)).toBe('unverified');
  });
});
