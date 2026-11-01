import { ReadyResponse } from '@chronos/contracts';
import { describe, expect, it } from 'vitest';
import { createDependencies } from '../src/deps';
import { makeApp, up } from './helpers';
import { useTestDatabase } from '@chronos/db/testing';

const t = useTestDatabase();
const redisUrl = (): string => {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL missing: run pnpm dev:up and create .env');
  return url;
};

async function ready(deps: Parameters<typeof makeApp>[0]) {
  const app = await makeApp(deps);
  const started = performance.now();
  const res = await app.inject({ method: 'GET', url: '/ready' });
  const ms = performance.now() - started;
  await app.close();
  return { status: res.statusCode, body: ReadyResponse.parse(res.json()), ms };
}

describe('GET /ready reflects real dependency state', () => {
  it('is ready (200) with the real test database and the local Redis', async () => {
    const deps = createDependencies({ databaseUrl: t.url, redisUrl: redisUrl() });
    const r = await ready({ deps });
    await deps.close();
    expect(r).toMatchObject({
      status: 200,
      body: { status: 'ready', checks: { database: 'up', redis: 'up' } },
    });
  });

  it('is not ready (503) when PostgreSQL is unreachable', async () => {
    const deps = createDependencies({ databaseUrl: 'postgres://u:p@127.0.0.1:1/none', redisUrl: redisUrl() });
    const r = await ready({ deps });
    await deps.close();
    expect(r).toMatchObject({
      status: 503,
      body: { status: 'not_ready', checks: { database: 'down', redis: 'up' } },
    });
  });

  it('is not ready (503) when Redis is unreachable, and answers within the probe timeout', async () => {
    const deps = createDependencies({ databaseUrl: t.url, redisUrl: 'redis://127.0.0.1:1/0' });
    const r = await ready({ deps });
    await deps.close();
    expect(r).toMatchObject({
      status: 503,
      body: { status: 'not_ready', checks: { database: 'up', redis: 'down' } },
    });
    expect(r.ms).toBeLessThan(2500);
  });

  it('is not ready (503) while shutting down, even with healthy dependencies', async () => {
    const r = await ready({ deps: { database: up, redis: up }, lifecycle: { shuttingDown: true } });
    expect(r).toMatchObject({
      status: 503,
      body: { status: 'not_ready', checks: { database: 'up', redis: 'up' } },
    });
  });
});
