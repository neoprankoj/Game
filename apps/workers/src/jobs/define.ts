import type { BackoffOptions, Job } from 'bullmq';
import type { Logger } from 'pino';
import type { z } from 'zod';
import { JOB_NAME, type QueueName } from '../queues';

export interface JobContext<P> {
  /** Decoded, validated payload (bigint/epoch ms, not wire strings). */
  payload: P;
  job: Job;
  log: Logger;
}

export interface JobDefinition<S extends z.ZodType = z.ZodType, R = unknown> {
  name: string;
  queue: QueueName;
  /** Wire schema: jobs are stored as JSON, so codecs (contracts) describe bigint/instants as strings. */
  payload: S;
  /** Total attempts, including the first. */
  attempts: number;
  backoff: BackoffOptions;
  /** Must be idempotent: a job can run more than once (at-least-once delivery, SYSTEM_ARCHITECTURE §7.2). */
  handler(context: JobContext<z.output<S>>): Promise<R>;
}

/**
 * Default retry policy: 5 attempts, exponential backoff from 1 s with 50% jitter (spreads retries after an outage).
 * After the last attempt the job stays in the queue's FAILED set, which is our dead-letter queue (kept 14 days).
 */
export const DEFAULT_ATTEMPTS = 5;
export const DEFAULT_BACKOFF: BackoffOptions = { type: 'exponential', delay: 1000, jitter: 0.5 };
export const RETENTION = {
  removeOnComplete: { age: 60 * 60, count: 1000 },
  removeOnFail: { age: 14 * 24 * 60 * 60 },
} as const;

export function defineJob<const S extends z.ZodType, R>(
  definition: Omit<JobDefinition<S, R>, 'attempts' | 'backoff'> &
    Partial<Pick<JobDefinition<S, R>, 'attempts' | 'backoff'>>,
): JobDefinition<S, R> {
  if (!JOB_NAME.test(definition.name))
    throw new Error(`job name "${definition.name}" must be <domain>.<action>`);
  return { attempts: DEFAULT_ATTEMPTS, backoff: DEFAULT_BACKOFF, ...definition };
}
