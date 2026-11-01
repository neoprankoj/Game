import { randomUUID } from 'node:crypto';
import {
  ApiClientError,
  createApiClient,
  healthRoute,
  readyRoute,
  routes,
  type RouteContract,
} from '@chronos/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeApp } from './helpers';

// The typed client from @chronos/contracts against the real API listening on a port: no hand-written types
// on either side (closes the API half of Part 2.4's open criterion end to end).
let app: Awaited<ReturnType<typeof makeApp>>;
let baseUrl: string;
beforeAll(async () => {
  app = await makeApp();
  baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
});
afterAll(async () => {
  await app.close();
});
const client = () => createApiClient({ baseUrl, newIdempotencyKey: () => randomUUID() });

describe('typed client ↔ real API', () => {
  it('calls /health and /ready with decoded, typed results', async () => {
    expect(await client().call(healthRoute, {})).toEqual({ status: 200, body: { status: 'ok' } });
    const ready = await client().call(readyRoute, {});
    expect(ready.status).toBe(200);
    expect(ready.body.checks).toEqual({ database: 'up', redis: 'up' });
  });

  it('surfaces API errors as ApiClientError with the server request id', async () => {
    const ghost: RouteContract = { ...healthRoute, id: 'test.ghost', path: '/no-such-route' };
    const error = await client()
      .call(ghost, {})
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect((error as ApiClientError).requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('can reach every route in the registry (the client and the server share one list)', () => {
    expect(routes.map((r) => r.id).sort()).toEqual(['system.health', 'system.ready']);
  });
});
