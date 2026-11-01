import { UnrecoverableError, Worker, type ConnectionOptions, type Job } from 'bullmq';
import type { Logger } from 'pino';
import { z } from 'zod';
import { RECONCILER_SCHEDULER_ID, reconcileJob, type JobDefinition } from './jobs';
import { JobProducer } from './producer';
import type { QueueName } from './queues';

export interface RuntimeOptions {
  connection: ConnectionOptions;
  prefix: string;
  jobs: readonly JobDefinition[];
  log: Logger;
  concurrency: number;
  /** 0 disables the reconciler scheduler (tests). */
  reconcilerIntervalMs: number;
}

export interface Runtime {
  producer: JobProducer;
  /** Stops fetching new jobs, waits for in-flight jobs, closes connections (graceful shutdown). */
  close(): Promise<void>;
}

const isFinalAttempt = (job: Job, error: Error): boolean =>
  error instanceof UnrecoverableError || job.attemptsMade >= (job.opts.attempts ?? 1);

/** Starts one BullMQ worker per queue that has jobs, dispatching by job name to validated handlers. */
export async function startRuntime(options: RuntimeOptions): Promise<Runtime> {
  const { connection, prefix, log } = options;
  const byName = new Map<string, JobDefinition>();
  for (const def of options.jobs) {
    if (byName.has(def.name)) throw new Error(`duplicate job name ${def.name}`);
    byName.set(def.name, def);
  }
  const queueNames = [...new Set(options.jobs.map((j) => j.queue))] as QueueName[];

  const workers = queueNames.map((queueName) => {
    const worker = new Worker(
      queueName,
      async (job) => {
        const def = byName.get(job.name);
        if (!def || def.queue !== queueName)
          throw new UnrecoverableError(`unknown job ${job.name} on ${queueName}`);
        const decoded = z.safeDecode(def.payload, job.data);
        if (!decoded.success) {
          // A payload that does not match its schema will never succeed: skip retries, dead-letter at once.
          throw new UnrecoverableError(`invalid payload for ${job.name}: ${decoded.error.message}`);
        }
        const jobLog = log.child({
          queue: queueName,
          job: job.name,
          jobId: job.id,
          attempt: job.attemptsMade + 1,
        });
        return def.handler({ payload: decoded.data, job, log: jobLog });
      },
      { connection, prefix, concurrency: options.concurrency },
    );
    worker.on('completed', (job) => {
      log.debug({ queue: queueName, job: job.name, jobId: job.id }, 'job completed');
    });
    worker.on('failed', (job, error) => {
      if (!job) return;
      const context = {
        queue: queueName,
        job: job.name,
        jobId: job.id,
        attemptsMade: job.attemptsMade,
        err: error,
      };
      if (isFinalAttempt(job, error)) log.error(context, 'job dead-lettered (failed set)');
      else log.warn(context, 'job failed; will retry');
    });
    worker.on('error', (error) => {
      log.error({ queue: queueName, err: error }, 'worker error');
    });
    return worker;
  });

  const producer = new JobProducer(connection, prefix);
  if (options.reconcilerIntervalMs > 0) {
    // Upsert: restarting (or running several worker processes) never creates duplicate schedules.
    await producer.queue(reconcileJob.queue).upsertJobScheduler(
      RECONCILER_SCHEDULER_ID,
      { every: options.reconcilerIntervalMs },
      {
        name: reconcileJob.name,
        data: {},
        opts: { attempts: reconcileJob.attempts, removeOnComplete: 100, removeOnFail: 100 },
      },
    );
  }
  await Promise.all(workers.map((w) => w.waitUntilReady()));
  log.info({ queues: queueNames, concurrency: options.concurrency }, 'workers started');

  return {
    producer,
    close: async () => {
      await Promise.all(workers.map((w) => w.close())); // waits for active jobs to finish
      await producer.close();
    },
  };
}
