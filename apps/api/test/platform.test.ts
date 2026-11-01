import { ErrorResponse } from '@chronos/contracts';
import { describe, expect, it } from 'vitest';
import { captureLogs, makeApp, testConfig } from './helpers';

describe('rate limiting', () => {
  it('returns 429 RATE_LIMITED in the contract shape with Retry-After after the limit', async () => {
    const app = await makeApp({ config: { ...testConfig, rateLimit: { max: 3, windowMs: 60_000 } } });
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) codes.push((await app.inject({ method: 'GET', url: '/health' })).statusCode);
    const res = await app.inject({ method: 'GET', url: '/health' });
    await app.close();
    expect(codes).toEqual([200, 200, 200, 429]);
    expect(ErrorResponse.parse(res.json()).error.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });
});

describe('CORS', () => {
  it('allows the configured web origin with credentials', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { origin: 'http://localhost:8081', 'access-control-request-method': 'GET' },
    });
    await app.close();
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:8081');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not allow other origins', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example' },
    });
    await app.close();
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('structured logging (ADR-0010)', () => {
  it('logs request ids and paths but never secrets, cookies, idempotency keys or query strings', async () => {
    const { logger, lines } = captureLogs();
    const app = await makeApp({ logger });
    const res = await app.inject({
      method: 'GET',
      url: '/health?token=supersecret-token',
      headers: {
        authorization: 'Bearer secret-bearer',
        cookie: 'session=secret-cookie',
        'idempotency-key': 'secret-idem-key-123',
      },
    });
    await app.close();
    const all = lines.join('\n');
    expect(lines.length).toBeGreaterThan(0);
    expect(all).toContain(String(res.headers['x-request-id']));
    expect(all).toContain('"path":"/health"');
    for (const secret of ['supersecret-token', 'secret-bearer', 'secret-cookie', 'secret-idem-key-123']) {
      expect(all).not.toContain(secret);
    }
  });
});
