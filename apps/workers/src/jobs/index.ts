import type { JobDefinition } from './define';
import { echoJob, failJob } from './diagnostics';
import { reconcileJob } from './reconciler';

export {
  DEFAULT_ATTEMPTS,
  DEFAULT_BACKOFF,
  RETENTION,
  defineJob,
  type JobContext,
  type JobDefinition,
} from './define';
export { echoJob, failJob } from './diagnostics';
export { RECONCILER_SCHEDULER_ID, reconcileJob } from './reconciler';

/** Every job this worker process knows. Names must be unique (checked at startup). */
export const jobs: readonly JobDefinition[] = [echoJob, failJob, reconcileJob];
