import { AmountString, ErrorResponse, InstantString, defineRoute } from '@chronos/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { bind } from '../src/http/contract-route';
import { ApiError } from '../src/http/errors';
import { makeApp, publicRoutes } from './helpers';

const Body = z.object({ amount: AmountString, label: z.string().max(10) }).meta({ id: 'ApiTestBody' });
const Result = z.object({ amount: AmountString, at: InstantString }).meta({ id: 'ApiTestResult' });
const thing = defineRoute({
  id: 'test.createThing',
  method: 'POST',
  path: '/test/things/{thingId}',
  summary: 'test-only route',
  tags: ['test'],
  auth: 'none',
  idempotent: true,
  request: { params: z.object({ thingId: z.uuid() }), body: Body },
  responses: { 201: { description: 'created', schema: Result } },
  errors: ['INSUFFICIENT_RESOURCES'],
});

let behaviour: 'ok' | 'domain-error' | 'crash' | 'bad-output' = 'ok';
const binding = bind(thing, ({ body }) => {
  if (behaviour === 'domain-error')
    return Promise.reject(new ApiError('INSUFFICIENT_RESOURCES', 'Not enough ore.', { ore: '120' }));
  if (behaviour === 'crash') return Promise.reject(new Error('db password=hunter2 leaked?'));
  if (behaviour === 'bad-output')
    return Promise.resolve({ status: 201, body: { amount: -5n, at: 0 } } as const);
  return Promise.resolve({
    status: 201,
    body: { amount: body.amount * 2n, at: Date.UTC(2026, 10, 1) },
  } as const);
});

const ID = '018f0000-0000-7000-8000-00000000000a';
const KEY = { 'idempotency-key': 'k-0123456789abcdef' };
const app = () => makeApp({ modules: [binding], registry: [...publicRoutes, thing] });

async function call(opts: {
  url?: string;
  headers?: Record<string, string>;
  payload?: unknown;
  body?: string;
}) {
  const a = await app();
  const res = await a.inject({
    method: 'POST',
    url: opts.url ?? `/test/things/${ID}`,
    headers: { 'content-type': 'application/json', ...KEY, ...opts.headers },
    ...(opts.body !== undefined ? { body: opts.body } : { payload: opts.payload as object }),
  });
  await a.close();
  return res;
}
const error = (res: { json(): unknown; headers: Record<string, unknown> }) => {
  const parsed = ErrorResponse.parse(res.json()).error;
  expect(parsed.requestId).toBe(res.headers['x-request-id']); // every error is traceable
  return parsed;
};

describe('contract routes: decoding and encoding', () => {
  it('decodes wire input (bigint strings) and encodes the response through the contract', async () => {
    behaviour = 'ok';
    const res = await call({ payload: { amount: '9007199254740993', label: 'ore' } });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ amount: '18014398509481986', at: '2026-11-01T00:00:00.000Z' });
  });
});

describe('contract-shaped errors', () => {
  it('unknown route → 404 NOT_FOUND', async () => {
    const a = await app();
    const res = await a.inject({ method: 'GET', url: '/does-not-exist?token=x' });
    await a.close();
    expect(res.statusCode).toBe(404);
    expect(error(res)).toMatchObject({ code: 'NOT_FOUND', message: 'No route GET /does-not-exist' });
  });

  it('missing Idempotency-Key on a mutating route → 400 IDEMPOTENCY_KEY_REQUIRED', async () => {
    const res = await call({ headers: { 'idempotency-key': 'short' }, payload: { amount: '1', label: 'x' } });
    expect(res.statusCode).toBe(400);
    expect(error(res).code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('invalid body → 400 VALIDATION_FAILED with issue locations', async () => {
    const res = await call({ payload: { amount: '-1', label: 'far too long label' } });
    expect(res.statusCode).toBe(400);
    const e = error(res);
    expect(e.code).toBe('VALIDATION_FAILED');
    expect(e.details?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ location: 'body', path: 'amount' }),
        expect.objectContaining({ location: 'body', path: 'label' }),
      ]),
    );
  });

  it('invalid path parameter → 400 VALIDATION_FAILED (params)', async () => {
    const res = await call({ url: '/test/things/not-a-uuid', payload: { amount: '1', label: 'x' } });
    expect(error(res)).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: { issues: [expect.objectContaining({ location: 'params' })] },
    });
  });

  it('malformed JSON → 400 VALIDATION_FAILED', async () => {
    const res = await call({ body: '{"amount": ' });
    expect(res.statusCode).toBe(400);
    expect(error(res).code).toBe('VALIDATION_FAILED');
  });

  it('unsupported content type → 400 VALIDATION_FAILED', async () => {
    const res = await call({ headers: { 'content-type': 'text/plain' }, body: 'hello' });
    expect(res.statusCode).toBe(400);
    expect(error(res).code).toBe('VALIDATION_FAILED');
  });

  it('oversized body → 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await call({ body: JSON.stringify({ amount: '1', label: 'x'.repeat(200_000) }) });
    expect(res.statusCode).toBe(413);
    expect(error(res).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('domain error from a handler → its catalog status, code and details', async () => {
    behaviour = 'domain-error';
    const res = await call({ payload: { amount: '1', label: 'x' } });
    expect(res.statusCode).toBe(422);
    expect(error(res)).toMatchObject({ code: 'INSUFFICIENT_RESOURCES', details: { ore: '120' } });
  });

  it('unexpected exception → 500 INTERNAL_ERROR without leaking the message', async () => {
    behaviour = 'crash';
    const res = await call({ payload: { amount: '1', label: 'x' } });
    expect(res.statusCode).toBe(500);
    expect(error(res)).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Internal error.' });
    expect(res.body).not.toContain('hunter2');
  });

  it('a handler response that violates the contract is never sent (500 instead)', async () => {
    behaviour = 'bad-output';
    const res = await call({ payload: { amount: '1', label: 'x' } });
    expect(res.statusCode).toBe(500);
    expect(error(res).code).toBe('INTERNAL_ERROR');
  });
});
