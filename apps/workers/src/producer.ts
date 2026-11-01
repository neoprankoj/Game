import { Queue, type ConnectionOptions } from 'bullmq';
import { z } from 'zod';
import { RETENTION, type JobDefinition } from './jobs';
import { JOB_ID, type QueueName } from './queues';

export interface EnqueueOptions {
  /** Deterministic id → duplicates are ignored by BullMQ (de-duplication, Part 3.4). */
  jobId?: string;
  /** Run no earlier than this epoch-ms instant (delayed job). Server time only (rule 5). */
  runAt?: number;
  /** Injected clock for computing the delay from `runAt` (no Date.now in callers). */
  now?: () => number;
}

/**
 * Enqueues validated jobs. The payload is checked and ENCODED against the job's wire schema before it is
 * stored, so a worker never receives something the producer could not have sent. The JobScheduler port of
 * ADR-0008 (Part 3.4) is implemented on top of this.
 */
export class JobProducer {
  private readonly queues = new Map<QueueName, Queue>();

  constructor(
    private readonly connection: ConnectionOptions,
    private readonly prefix: string,
  ) {}

  queue(name: QueueName): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: this.connection, prefix: this.prefix });
      this.queues.set(name, queue);
    }
    return queue;
  }

  async enqueue<S extends z.ZodType>(
    definition: JobDefinition<S>,
    payload: z.output<S>,
    options: EnqueueOptions = {},
  ): Promise<string> {
    if (options.jobId !== undefined && !JOB_ID.test(options.jobId)) {
      throw new Error(`job id "${options.jobId}" must look like <kind>.<id> (no ":"; see queues.ts)`);
    }
    const wire = z.encode(definition.payload, payload) as object; // throws ZodError on invalid payloads
    const delay = options.runAt === undefined ? 0 : Math.max(0, options.runAt - (options.now ?? Date.now)());
    const job = await this.queue(definition.queue).add(definition.name, wire, {
      attempts: definition.attempts,
      backoff: definition.backoff,
      ...RETENTION,
      ...(options.jobId ? { jobId: options.jobId } : {}),
      ...(delay > 0 ? { delay } : {}),
    });
    if (!job.id) throw new Error(`queue ${definition.queue} returned a job without id`);
    return job.id;
  }

  async close(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }
}
