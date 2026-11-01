// `pnpm --filter @chronos/workers enqueue:sample`: proves the job pipeline against running workers (Part 2.6).
// 1. enqueue diagnostics.echo and wait until it completes;
// 2. enqueue diagnostics.fail and wait until it lands in the failed set after all retries.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { QueueEvents } from 'bullmq';
import { loadConfig } from '../src/config';
import { echoJob, failJob } from '../src/jobs';
import { JobProducer } from '../src/producer';
import { QUEUES } from '../src/queues';
import { createRedisConnection } from '../src/redis';

const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (!process.env.REDIS_URL && existsSync(rootEnv)) process.loadEnvFile(rootEnv);
const config = loadConfig();
const connection = createRedisConnection(config.REDIS_URL);
const producer = new JobProducer(connection, config.QUEUE_PREFIX);
// BullMQ never closes connections it was given, so every connection created here is quit at the end.
const eventsConnection = createRedisConnection(config.REDIS_URL);
const events = new QueueEvents(QUEUES.diagnostics, {
  connection: eventsConnection,
  prefix: config.QUEUE_PREFIX,
});
await events.waitUntilReady();
const queue = producer.queue(QUEUES.diagnostics);

const echoId = await producer.enqueue(echoJob, { message: 'hello from enqueue-sample' });
const echo = await queue.getJob(echoId);
const result: unknown = await echo?.waitUntilFinished(events, 15_000);
const done = await queue.getJob(echoId);
console.log(
  JSON.stringify({
    step: 'echo',
    jobId: echoId,
    state: await done?.getState(),
    attemptsMade: done?.attemptsMade,
    result,
  }),
);

const failId = await producer.enqueue(failJob, { reason: 'sample' });
const failing = await queue.getJob(failId);
await failing?.waitUntilFinished(events, 15_000).catch(() => undefined); // rejects once all retries are exhausted
const failed = await queue.getJob(failId);
console.log(
  JSON.stringify({
    step: 'fail',
    jobId: failId,
    state: await failed?.getState(),
    attemptsMade: failed?.attemptsMade,
    failedReason: failed?.failedReason,
    failedSetSize: await queue.getFailedCount(),
  }),
);
await events.close();
await producer.close();
await Promise.all([connection.quit(), eventsConnection.quit()]);
