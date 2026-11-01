import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  AmountString,
  ApiClientError,
  InstantString,
  createApiClient,
  defineRoute,
  readyRoute,
} from '../src';

const Body = z.object({ amount: AmountString }).meta({ id: 'ClientTestBody' });
const Result = z.object({ amount: AmountString, at: InstantString }).meta({ id: 'ClientTestResult' });
const spend = defineRoute({
  id: 'test.spend',
  method: 'POST',
  path: '/cities/{cityId}/spend',
  summary: 's',
  tags: ['t'],
  auth: 'none',
  idempotent: true,
  request: {
    params: z.object({ cityId: z.uuid() }),
    query: z.object({ dryRun: z.boolean().optional() }),
    body: Body,
  },
  responses: { 201: { description: 'ok', schema: Result } },
  errors: ['INSUFFICIENT_RESOURCES'],
});
const CITY = '018f0000-0000-7000-8000-00000000000a';

interface Seen {
  url: string;
  init: RequestInit;
}
function fakeFetch(status: number, body: unknown, seen: Seen[] = [], headers: Record<string, string> = {}) {
  const f = (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: url instanceof Request ? url.url : url.toString(), init: init ?? {} });
    return Promise.resolve(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', ...headers },
      }),
    );
  };
  return f;
}
const client = (f: typeof fetch) =>
  createApiClient({
    baseUrl: 'https://api.test/v',
    fetch: f,
    newIdempotencyKey: () => 'generated-key-0123456789',
  });

describe('typed API client', () => {
  it('builds the URL, encodes bigint bodies, sends Idempotency-Key, and decodes the response', async () => {
    const seen: Seen[] = [];
    const c = client(fakeFetch(201, { amount: '9007199254740993', at: '2026-11-01T00:00:00.000Z' }, seen));
    const result = await c.call(spend, {
      params: { cityId: CITY },
      query: { dryRun: true },
      body: { amount: 2n ** 53n + 1n },
    });
    expect(result).toEqual({ status: 201, body: { amount: 9007199254740993n, at: Date.UTC(2026, 10, 1) } });
    expect(seen[0]?.url).toBe(`https://api.test/v/cities/${CITY}/spend?dryRun=true`);
    expect(seen[0]?.init.method).toBe('POST');
    expect(seen[0]?.init.body).toBe('{"amount":"9007199254740993"}');
    expect((seen[0]?.init.headers as Record<string, string>)['Idempotency-Key']).toBe(
      'generated-key-0123456789',
    );
  });

  it('reuses a caller-provided idempotency key (retrying the same intent)', async () => {
    const seen: Seen[] = [];
    const c = client(fakeFetch(201, { amount: '1', at: '2026-11-01T00:00:00.000Z' }, seen));
    await c.call(
      spend,
      { params: { cityId: CITY }, query: {}, body: { amount: 1n } },
      { idempotencyKey: 'retry-key-0123456789' },
    );
    expect((seen[0]?.init.headers as Record<string, string>)['Idempotency-Key']).toBe('retry-key-0123456789');
  });

  it('returns declared non-2xx responses (e.g. /ready 503) as results, not errors', async () => {
    const c = client(fakeFetch(503, { status: 'not_ready', checks: { database: 'down', redis: 'up' } }));
    const r = await c.call(readyRoute, {});
    expect(r.status).toBe(503);
  });

  it('turns contract error responses into ApiClientError with code, details and request id', async () => {
    const body = {
      error: {
        code: 'INSUFFICIENT_RESOURCES',
        message: 'Not enough ore',
        details: { ore: '5' },
        requestId: 'req-1',
      },
    };
    const c = client(fakeFetch(422, body));
    const error = await c
      .call(spend, { params: { cityId: CITY }, query: {}, body: { amount: 1n } })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      code: 'INSUFFICIENT_RESOURCES',
      status: 422,
      details: { ore: '5' },
      requestId: 'req-1',
    });
  });

  it('flags responses that violate the contract instead of passing bad data to the UI', async () => {
    const c = client(fakeFetch(201, { amount: 'lots', at: 'yesterday' }));
    await expect(
      c.call(spend, { params: { cityId: CITY }, query: {}, body: { amount: 1n } }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('reports network failures and timeouts distinctly', async () => {
    const down = (() => Promise.reject(new TypeError('fetch failed'))) as typeof fetch;
    await expect(client(down).call(readyRoute, {})).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    const hang = ((_url: string, init?: RequestInit) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      })) as typeof fetch;
    const slow = createApiClient({
      baseUrl: 'https://api.test',
      fetch: hang,
      newIdempotencyKey: () => 'k',
      timeoutMs: 50,
    });
    await expect(slow.call(readyRoute, {})).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('rejects inputs that do not match the contract before sending anything', async () => {
    const seen: Seen[] = [];
    const c = client(fakeFetch(201, {}, seen));
    await expect(
      c.call(spend, { params: { cityId: 'not-a-uuid' }, query: {}, body: { amount: 1n } }),
    ).rejects.toThrow();
    expect(seen).toEqual([]);
  });
});
