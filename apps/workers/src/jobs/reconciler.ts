import { z } from 'zod';
import { QUEUES } from '../queues';
import { defineJob } from './define';

export const RECONCILER_SCHEDULER_ID = 'reconciler';

/**
 * Reconciler (crash recovery) skeleton. Part 3.5 makes it find scheduled timed actions with
 * `completes_at < now − grace` and settle their owners in small batches (FOR NO KEY UPDATE SKIP LOCKED),
 * so correctness never depends on a job having run (rule 7). Until then there are no timed actions to sweep.
 */
export const reconcileJob = defineJob({
  name: 'maintenance.reconcile',
  queue: QUEUES.maintenance,
  payload: z.object({}),
  attempts: 1, // the next scheduled sweep is the retry
  handler: ({ log }) => {
    log.debug('reconciler sweep: no timed actions yet (Part 3.5)');
    return Promise.resolve({ overdue: 0 });
  },
});
