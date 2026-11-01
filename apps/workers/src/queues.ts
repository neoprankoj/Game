/**
 * Queue naming conventions (ADR-0008):
 * - queue names are kebab-case nouns for a *kind of work*: `timed-actions`, `maintenance`, `diagnostics`.
 *   Region sharding (SYSTEM_ARCHITECTURE §12, step S5) appends the region: `timed-actions.r1`;
 * - job names are `<domain>.<action>` (e.g. `maintenance.reconcile`), like events and route ids;
 * - job ids are deterministic for de-duplication: `<kind>.<entity id>` (e.g. `timed-action.<uuid>`, Part 3.4).
 *   BullMQ 6 rejects custom ids containing `:` (it uses `:` in its Redis keys), found in Part 2.6;
 * - every key lives under the configured prefix (`chronos:` by default) so queues can share a Redis safely.
 */
export const QUEUES = {
  /** Timed-action completions (Part 3.4). */
  timedActions: 'timed-actions',
  /** Periodic housekeeping: reconciler (3.5), retention sweeps (S10/S12). */
  maintenance: 'maintenance',
  /** Operational checks: prove the pipeline end to end (Part 2.6). */
  diagnostics: 'diagnostics',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
export const JOB_NAME = /^[a-z][a-zA-Z]*\.[a-z][a-zA-Z]*$/;
/** Deterministic job id: `<kind>.<id>`; no `:` (BullMQ key separator) and no whitespace. */
export const JOB_ID = /^[a-z][a-z0-9-]*\.[A-Za-z0-9_-]{1,128}$/;
