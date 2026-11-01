import { BigIntString } from '@chronos/contracts';
import type { Redis } from 'ioredis';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z, ZodError } from 'zod';
import { defineJob, type JobDefinition } from '../src/jobs';
import { QUEUES } from '../src/queues';
import { createRedisConnection } from '../src/redis';
import { startRuntime, type Runtime } from '../src/runtime';
import { capturingLogger, deletePrefix, redisUrl, testPrefix, until } from './helpers';

let connection: Redis;
let runtime: Runtime | undefined;
const prefix = testPrefix();
beforeAll(() => {
  connection = createRedisConnection(redisUrl());
});
afterEach(async () => {
  await runtime?.close();
  runtime = undefined;
});
afterAll(async () => {
  await connection.quit();
  await deletePrefix(prefix);
});

const calls: Record<string, number> = {};
const count = (name: string) => (calls[name] = (calls[name] ?? 0) + 1);

const echo = defineJob({
  name: 'test.echo',
  queue: QUEUES.diagnostics,
  payload: z.object({ message: z.string() }),
  handler: ({ payload }) => {
    count('echo');
    return Promise.resolve({ echoed: payload.message });
  },
});
const failing = defineJob({
  name: 'test.failing',
  queue: QUEUES.diagnostics,
  payload: z.object({}),
  attempts: 3,
  backoff: { type: 'fixed', delay: 10 },
  handler: () => {
    count('failing');
    return Promise.reject(new Error('boom'));
  },
});
let received: unknown;
const money = defineJob({
  name: 'test.money',
  queue: QUEUES.diagnostics,
  payload: z.object({ amount: BigIntString }),
  handler: ({ payload }) => {
    received = payload.amount;
    return Promise.resolve(null);
  },
});
const all: JobDefinition[] = [echo, failing, money];

const start = async (log = capturingLogger().log) => {
  runtime = await startRuntime({
    connection,
    prefix,
    jobs: all,
    log,
    concurrency: 2,
    reconcilerIntervalMs: 0,
  });
  return runtime;
};

describe('job payload validation', () => {
  it('rejects an invalid payload at enqueue time and stores nothing', async () => {
    const r = await start();
    const before = await r.producer
      .queue(QUEUES.diagnostics)
      .getJobCountByTypes('waiting', 'delayed', 'active');
    await expect(r.producer.enqueue(echo, { message: 42 } as never)).rejects.toBeInstanceOf(ZodError);
    expect(
      await r.producer.queue(QUEUES.diagnostics).getJobCountByTypes('waiting', 'delayed', 'active'),
    ).toBe(before);
  });

  it('dead-letters a stored job whose payload is invalid at once, without retries or running the handler', async () => {
    const r = await start();
    const before = calls.echo ?? 0;
    const queue = r.producer.queue(QUEUES.diagnostics);
    const job = await queue.add('test.echo', { message: 7 }, { attempts: 5 }); // bypasses the producer on purpose
    await until(async () => (await job.getState()) === 'failed');
    const failed = await queue.getJob(String(job.id));
    expect(failed?.attemptsMade).toBe(1);
    expect(failed?.failedReason).toMatch(/invalid payload for test\.echo/);
    expect(calls.echo ?? 0).toBe(before);
  });

  it('enforces <domain>.<action> job names', () => {
    expect(() => defineJob({ ...echo, name: 'Echo' })).toThrow(/domain/);
  });

  it('carries bigint payloads through the wire codec exactly', async () => {
    const r = await start();
    const id = await r.producer.enqueue(money, { amount: 2n ** 63n - 1n });
    await until(
      async () => (await r.producer.queue(QUEUES.diagnostics).getJob(id))?.finishedOn !== undefined,
    );
    expect(received).toBe(2n ** 63n - 1n);
  });
});

describe('processing', () => {
  it('processes a job exactly once, even if the same deterministic jobId is enqueued twice', async () => {
    const r = await start();
    const before = calls.echo ?? 0;
    const a = await r.producer.enqueue(echo, { message: 'hi' }, { jobId: 'test-echo.1' });
    const b = await r.producer.enqueue(echo, { message: 'hi again' }, { jobId: 'test-echo.1' });
    expect(a).toBe(b);
    await until(async () => (await r.producer.queue(QUEUES.diagnostics).getJob(a))?.finishedOn !== undefined);
    const job = await r.producer.queue(QUEUES.diagnostics).getJob(a);
    expect(job?.returnvalue).toEqual({ echoed: 'hi' });
    expect(job?.attemptsMade).toBe(1);
    await new Promise((res) => setTimeout(res, 200)); // give a duplicate the chance to run, if it existed
    expect((calls.echo ?? 0) - before).toBe(1);
  });

  it('retries a failing job and leaves it in the failed set (dead letter) after the last attempt', async () => {
    const { log, lines } = capturingLogger();
    const r = await start(log);
    const before = calls.failing ?? 0;
    const id = await r.producer.enqueue(failing, {});
    const queue = r.producer.queue(QUEUES.diagnostics);
    await until(
      async () =>
        (await queue.getJob(id))?.finishedOn !== undefined && (await queue.getJob(id))?.attemptsMade === 3,
    );
    const job = await queue.getJob(id);
    expect(await job?.getState()).toBe('failed');
    expect(job?.attemptsMade).toBe(3);
    expect((calls.failing ?? 0) - before).toBe(3);
    const msgs = lines()
      .filter((l) => l.jobId === id)
      .map((l) => l.msg);
    expect(msgs).toEqual([
      'job failed; will retry',
      'job failed; will retry',
      'job dead-lettered (failed set)',
    ]);
  });

  it('rejects job ids BullMQ cannot store (":" is its key separator) before reaching Redis', async () => {
    const r = await start();
    await expect(r.producer.enqueue(echo, { message: 'x' }, { jobId: 'timed-action:123' })).rejects.toThrow(
      /<kind>\.<id>/,
    );
  });

  it('delays a job until runAt using the injected clock', async () => {
    const r = await start();
    const id = await r.producer.enqueue(
      echo,
      { message: 'later' },
      { runAt: 1_000_000 + 60_000, now: () => 1_000_000 },
    );
    const job = await r.producer.queue(QUEUES.diagnostics).getJob(id);
    expect(await job?.getState()).toBe('delayed');
    expect(job?.opts.delay).toBe(60_000);
    await job?.remove();
  });
});
