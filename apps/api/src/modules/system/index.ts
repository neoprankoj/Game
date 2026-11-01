import { healthRoute, readyRoute } from '@chronos/contracts';
import type { ApiDependencies } from '../../deps';
import { bind, type RouteBinding } from '../../http/contract-route';

export interface Lifecycle {
  /** Set when shutdown starts: readiness turns false so the platform stops routing new traffic here. */
  shuttingDown: boolean;
}

const PROBE_TIMEOUT_MS = 1000;

async function probe(check: () => Promise<void>): Promise<'up' | 'down'> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('probe timeout'));
    }, PROBE_TIMEOUT_MS);
  });
  try {
    await Promise.race([check(), timeout]);
    return 'up';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}

/** System module: liveness and readiness (Part 2.5). */
export function systemModule(
  deps: Pick<ApiDependencies, 'database' | 'redis'>,
  lifecycle: Lifecycle,
): RouteBinding[] {
  return [
    bind(healthRoute, () => Promise.resolve({ status: 200, body: { status: 'ok' } } as const)),
    bind(readyRoute, async () => {
      const [database, redis] = await Promise.all([
        probe(() => deps.database.ping()),
        probe(() => deps.redis.ping()),
      ]);
      const checks = { database, redis };
      return database === 'up' && redis === 'up' && !lifecycle.shuttingDown
        ? ({ status: 200, body: { status: 'ready', checks } } as const)
        : ({ status: 503, body: { status: 'not_ready', checks } } as const);
    }),
  ];
}
