import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineRoute, routes, type RouteContract } from '../src';

const Body = z.object({ name: z.string() }).meta({ id: 'TestBody' });
const Res = z.object({ ok: z.boolean() }).meta({ id: 'TestResult' });
const base = {
  id: 'test.create',
  method: 'POST',
  path: '/things/{thingId}',
  summary: 's',
  tags: ['test'],
  auth: 'session',
  idempotent: true,
  request: { params: z.object({ thingId: z.uuid() }), body: Body },
  responses: { 201: { description: 'created', schema: Res } },
  errors: [],
} as const satisfies RouteContract;

describe('defineRoute invariants', () => {
  it('accepts a well-formed route', () => {
    expect(defineRoute(base).id).toBe('test.create');
  });

  it('requires mutating routes to be idempotent, and reads not to be', () => {
    expect(() => defineRoute({ ...base, idempotent: false })).toThrow(/idempotent must be true/);
    expect(() => defineRoute({ ...base, method: 'GET', idempotent: true })).toThrow(
      /idempotent must be false/,
    );
  });

  it('requires path params and declared params to match', () => {
    expect(() => defineRoute({ ...base, path: '/things/{otherId}' })).toThrow(/path params/);
    expect(() => defineRoute({ ...base, request: { body: Body } })).toThrow(/path params/);
  });

  it('rejects ids that are not "domain.action"', () => {
    expect(() => defineRoute({ ...base, id: 'Create' })).toThrow(/domain\.action/);
  });
});

describe('route registry', () => {
  it('has unique ids and unique method + path pairs', () => {
    expect(new Set(routes.map((r) => r.id)).size).toBe(routes.length);
    expect(new Set(routes.map((r) => `${r.method} ${r.path}`)).size).toBe(routes.length);
  });
});
