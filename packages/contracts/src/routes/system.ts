import { z } from 'zod';
import { defineRoute } from './define';

export const HealthResponse = z
  .object({ status: z.literal('ok') })
  .meta({ id: 'HealthResponse', description: 'Liveness: the process is up (no dependency checks).' });

const DependencyState = z.enum(['up', 'down']);
export const ReadyResponse = z
  .object({
    status: z.enum(['ready', 'not_ready']),
    checks: z.object({ database: DependencyState, redis: DependencyState }),
  })
  .meta({
    id: 'ReadyResponse',
    description: 'Readiness: dependencies reachable (DB, Redis). 503 when not ready.',
  });

export const healthRoute = defineRoute({
  id: 'system.health',
  method: 'GET',
  path: '/health',
  summary: 'Liveness probe',
  tags: ['system'],
  auth: 'none',
  idempotent: false,
  responses: { 200: { description: 'Process is alive', schema: HealthResponse } },
  errors: [],
});

export const readyRoute = defineRoute({
  id: 'system.ready',
  method: 'GET',
  path: '/ready',
  summary: 'Readiness probe (database and Redis)',
  tags: ['system'],
  auth: 'none',
  idempotent: false,
  responses: {
    200: { description: 'All dependencies reachable', schema: ReadyResponse },
    503: { description: 'At least one dependency is down', schema: ReadyResponse },
  },
  errors: [],
});
