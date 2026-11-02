import { defineRoute, routes } from '@chronos/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { assertBindingsMatchRegistry, bind } from '../src/http/contract-route';
import { accountModule } from '../src/modules/account';
import { systemModule } from '../src/modules/system';
import { makeApp, publicRoutes, up } from './helpers';

const Res = z.object({ ok: z.boolean() }).meta({ id: 'RegTestRes' });
const extra = defineRoute({
  id: 'test.extra',
  method: 'GET',
  path: '/test/extra',
  summary: 's',
  tags: ['test'],
  auth: 'none',
  idempotent: false,
  responses: { 200: { description: 'ok', schema: Res } },
  errors: [],
});
const system = systemModule({ database: up, redis: up }, { shuttingDown: false });

describe('the API serves exactly the contracts registry (ADR-0013)', () => {
  it('passes for the production registry with the production modules', () => {
    expect(() => {
      assertBindingsMatchRegistry([...system, ...accountModule()], routes);
    }).not.toThrow();
  });

  it('fails startup when a registered contract has no handler', async () => {
    await expect(makeApp({ registry: [...publicRoutes, extra] })).rejects.toThrow(
      /test\.extra must be bound exactly once/,
    );
  });

  it('fails startup when a handler is bound to a contract outside the registry', async () => {
    const stray = bind(extra, () => Promise.resolve({ status: 200, body: { ok: true } } as const));
    await expect(makeApp({ modules: [stray] })).rejects.toThrow(/not in the contracts registry/);
  });

  it('fails startup when a contract is bound twice', () => {
    expect(() => {
      assertBindingsMatchRegistry([...system, ...system], publicRoutes);
    }).toThrow(/exactly once/);
  });

  it('refuses to serve a session-protected route in an app built without authentication', async () => {
    const secret = defineRoute({ ...extra, id: 'test.secret', path: '/test/secret', auth: 'session' });
    const binding = bind(secret, () => Promise.resolve({ status: 200, body: { ok: true } } as const));
    await expect(makeApp({ modules: [binding], registry: [...publicRoutes, secret] })).rejects.toThrow(
      /needs auth "session" but the app has no authentication/,
    );
  });

  it('cannot start the production registry without authentication (it contains protected routes)', async () => {
    await expect(makeApp({ registry: routes })).rejects.toThrow(/account\.get must be bound exactly once/);
  });
});
