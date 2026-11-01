import { HealthResponse } from '@chronos/contracts';
import { describe, expect, it } from 'vitest';
import { makeApp } from './helpers';

describe('GET /health', () => {
  it('returns the contract body, a request id and security headers', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(HealthResponse.parse(res.json())).toEqual({ status: 'ok' });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers['x-content-type-options']).toBe('nosniff'); // helmet
    await app.close();
  });

  it('keeps a well-formed incoming x-request-id and replaces a malformed one', async () => {
    const app = await makeApp();
    const kept = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'edge-req-12345678' },
    });
    expect(kept.headers['x-request-id']).toBe('edge-req-12345678');
    const replaced = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'bad id\n' },
    });
    expect(replaced.headers['x-request-id']).not.toBe('bad id\n');
    await app.close();
  });
});
