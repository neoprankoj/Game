import { z } from 'zod';
import { QUEUES } from '../queues';
import { defineJob } from './define';

/** Echoes a message back: proves enqueue → process → result end to end (ops check, Part 2.6). */
export const echoJob = defineJob({
  name: 'diagnostics.echo',
  queue: QUEUES.diagnostics,
  payload: z.object({ message: z.string().min(1).max(200) }),
  handler: ({ payload, log }) => {
    log.info({ message: payload.message }, 'echo');
    return Promise.resolve({ echoed: payload.message });
  },
});

/** Always fails: proves retries + dead-lettering into the failed set (ops check, Part 2.6). */
export const failJob = defineJob({
  name: 'diagnostics.fail',
  queue: QUEUES.diagnostics,
  payload: z.object({ reason: z.string().min(1).max(200) }),
  attempts: 3,
  backoff: { type: 'fixed', delay: 100 },
  handler: ({ payload }) => Promise.reject(new Error(`diagnostics failure: ${payload.reason}`)),
});
