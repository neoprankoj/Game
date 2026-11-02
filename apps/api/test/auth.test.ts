import { randomUUID } from 'node:crypto';
import {
  accountRoute,
  ApiClientError,
  authErrorCode,
  createApiClient,
  defineRoute,
  ErrorResponse,
  routes,
} from '@chronos/contracts';
import { useTestDatabase } from '@chronos/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { bind } from '../src/http/contract-route';
import { accountModule } from '../src/modules/account';
import { systemModule } from '../src/modules/system';
import {
  authPost,
  cookiesOf,
  createVerifiedAccount,
  getAccount,
  json,
  makeAuthApp,
  PASSWORD,
  WEB_ORIGIN,
  type AuthHarness,
} from './auth-helpers';
import { up } from './helpers';

const t = useTestDatabase();

// An admin-only route that exists only in this test (the MVP has no admin routes before 11.6).
const AdminRes = z.object({ ok: z.literal(true) }).meta({ id: 'AuthTestAdminRes' });
const adminProbe = defineRoute({
  id: 'test.adminProbe',
  method: 'GET',
  path: '/test/admin-probe',
  summary: 'test-only admin route',
  tags: ['test'],
  auth: 'admin',
  idempotent: false,
  responses: { 200: { description: 'ok', schema: AdminRes } },
  errors: [],
});

const deletionCalls: { accountId: string; userStillExisted: boolean }[] = [];
let h: AuthHarness;
beforeAll(async () => {
  h = await makeAuthApp(t.url, {
    deletionHooks: [
      async (accountId) => {
        // D01 deletion order: the hook (player anonymisation from 3.3/6.1) runs while the auth user still exists.
        const rows = await h.sql('select 1 from auth."user" where id = $1', [accountId]);
        deletionCalls.push({ accountId, userStillExisted: rows.length === 1 });
      },
    ],
    extra: {
      modules: [bind(adminProbe, () => Promise.resolve({ status: 200, body: { ok: true } } as const))],
      registry: [...routes, adminProbe],
    },
  });
});
afterAll(async () => {
  await h.close();
});

const email = () => `pilot-${randomUUID().slice(0, 8)}@example.com`;

describe('sign-up and email verification', () => {
  it('creates an unverified account, emails a link, and the link signs the user in', async () => {
    const address = email();
    const signUp = await authPost(h.app, '/sign-up/email', {
      email: address.toUpperCase(),
      password: PASSWORD,
      name: 'Commander',
      callbackURL: `${WEB_ORIGIN}/`,
    });
    expect(signUp.statusCode).toBe(200);
    expect(cookiesOf(signUp)).not.toMatch(/session_token/); // no session before verification
    const [row] = await h.sql<{ email: string; email_verified: boolean; role: string }>(
      'select email, email_verified, role from auth."user" where email = $1',
      [address],
    );
    expect(row).toEqual({ email: address, email_verified: false, role: 'player' }); // stored lowercase

    const link = h.mailer.last(address, 'verify-email')?.link;
    expect(link).toMatch(/^http:\/\/localhost:3000\/api\/auth\/verify-email\?token=/);
    const verified = await h.app.inject({
      method: 'GET',
      url: new URL(link ?? '').pathname + new URL(link ?? '').search,
    });
    expect(verified.statusCode).toBe(302);
    expect(verified.headers.location).toBe(`${WEB_ORIGIN}/`);
    const cookie = cookiesOf(verified);
    expect(cookie).toMatch(/^chronos\.session_token=/);

    const account = await getAccount(h.app, cookie);
    expect(account.statusCode).toBe(200);
    expect(json(account)).toMatchObject({ email: address, role: 'player', emailVerified: true });
  });

  it('refuses sign-in until the email is verified; the client can ask for a new link with its return URL', async () => {
    const address = email();
    await authPost(h.app, '/sign-up/email', { email: address, password: PASSWORD, name: 'C' });
    const signIn = await authPost(h.app, '/sign-in/email', { email: address, password: PASSWORD });
    expect(signIn.statusCode).toBe(403);
    expect(authErrorCode(json(signIn).code as string, signIn.statusCode)).toBe('AUTH_EMAIL_NOT_VERIFIED');
    expect(cookiesOf(signIn)).not.toMatch(/session_token/);

    const resend = await authPost(h.app, '/send-verification-email', {
      email: address,
      callbackURL: `${WEB_ORIGIN}/`,
    });
    expect(resend.statusCode).toBe(200);
    const link = h.mailer.last(address, 'verify-email')?.link ?? '';
    expect(new URL(link).searchParams.get('callbackURL')).toBe(`${WEB_ORIGIN}/`);
    const untrusted = await authPost(h.app, '/send-verification-email', {
      email: address,
      callbackURL: 'https://evil.example/',
    });
    expect(untrusted.statusCode).toBe(403);
  });

  it('a duplicate email (any letter case) gets the SAME answer as a new one, no second account, a notice to the owner', async () => {
    const address = email();
    const first = await authPost(h.app, '/sign-up/email', { email: address, password: PASSWORD, name: 'A' });
    const dup = await authPost(h.app, '/sign-up/email', {
      email: address.toUpperCase(),
      password: 'another password',
      name: 'B',
    });
    expect(dup.statusCode).toBe(first.statusCode);
    expect(Object.keys(json(dup)).sort()).toEqual(Object.keys(json(first)).sort());
    expect(json(dup).token).toBeNull();
    const rows = await h.sql('select id from auth."user" where email = $1', [address]);
    expect(rows).toHaveLength(1);
    expect(h.mailer.last(address, 'existing-account')).toBeDefined();
  });

  it('enforces the password policy (≥ 10 characters)', async () => {
    const res = await authPost(h.app, '/sign-up/email', { email: email(), password: '123456789', name: 'C' });
    expect(res.statusCode).toBe(400);
    expect(authErrorCode(json(res).code as string, res.statusCode)).toBe('VALIDATION_FAILED');
  });
});

describe('sign-in, sessions and sign-out', () => {
  it('wrong password and unknown email are indistinguishable', async () => {
    const address = email();
    await createVerifiedAccount(h, address);
    const wrong = await authPost(h.app, '/sign-in/email', { email: address, password: 'wrong password!' });
    const unknown = await authPost(h.app, '/sign-in/email', { email: email(), password: 'wrong password!' });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(wrong.statusCode);
    expect(json(unknown)).toEqual(json(wrong));
    expect(authErrorCode(json(wrong).code as string, 401)).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('signs in with an httpOnly, SameSite=Lax cookie that reaches protected routes; sign-out ends it', async () => {
    const address = email();
    await createVerifiedAccount(h, address);
    const signIn = await authPost(h.app, '/sign-in/email', { email: address, password: PASSWORD });
    expect(signIn.statusCode).toBe(200);
    const setCookie = [signIn.headers['set-cookie']].flat().join('\n');
    expect(setCookie).toMatch(/chronos\.session_token=[^;]+;.*HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    const cookie = cookiesOf(signIn);
    expect((await getAccount(h.app, cookie)).statusCode).toBe(200);

    const signOut = await authPost(h.app, '/sign-out', {}, { cookie });
    expect(signOut.statusCode).toBe(200);
    expect((await getAccount(h.app, cookie)).statusCode).toBe(401);
  });

  it('an expired session is rejected (expiry is checked against the database row)', async () => {
    const address = email();
    const cookie = await createVerifiedAccount(h, address);
    expect((await getAccount(h.app, cookie)).statusCode).toBe(200);
    await h.sql(
      `update auth.session set expires_at = now() - interval '1 second'
       where user_id = (select id from auth."user" where email = $1)`,
      [address],
    );
    const res = await getAccount(h.app, cookie);
    expect(res.statusCode).toBe(401);
    expect(ErrorResponse.parse(json(res)).error.code).toBe('UNAUTHENTICATED');
  });

  it('a revoked session (row deleted, e.g. by an admin) stops working immediately', async () => {
    const address = email();
    const cookie = await createVerifiedAccount(h, address);
    await h.sql('delete from auth.session where user_id = (select id from auth."user" where email = $1)', [
      address,
    ]);
    expect((await getAccount(h.app, cookie)).statusCode).toBe(401);
  });

  it('refuses a sign-in POST from an untrusted browser origin (CSRF)', async () => {
    const address = email();
    await createVerifiedAccount(h, address);
    const res = await authPost(
      h.app,
      '/sign-in/email',
      { email: address, password: PASSWORD },
      { origin: 'https://evil.example' },
    );
    expect(res.statusCode).toBe(403);
    // …and a request carrying the victim's cookie from another site cannot act for them.
    const cookie = await createVerifiedAccount(h, email());
    const forged = await authPost(h.app, '/sign-out', {}, { cookie, origin: 'https://evil.example' });
    expect(forged.statusCode).toBe(403);
    expect((await getAccount(h.app, cookie)).statusCode).toBe(200);
    // Browsers would not even send it: the CORS preflight does not allow the foreign origin.
    const preflight = await h.app.inject({
      method: 'OPTIONS',
      url: '/api/auth/sign-in/email',
      headers: {
        origin: 'https://evil.example',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves native clients: no Origin, the app scheme in expo-origin, the cookie sent back by hand', async () => {
    const address = email();
    await createVerifiedAccount(h, address);
    const signIn = await h.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { 'content-type': 'application/json', 'expo-origin': 'chronoscradle://' },
      payload: JSON.stringify({ email: address, password: PASSWORD }),
    });
    expect(signIn.statusCode).toBe(200);
    const cookie = cookiesOf(signIn);
    expect((await getAccount(h.app, cookie)).statusCode).toBe(200);
  });
});

describe('protected routes', () => {
  it('every non-public route in the registry rejects anonymous and forged sessions with 401', async () => {
    const protectedRoutes = routes.filter((r) => r.auth !== 'none');
    expect(protectedRoutes.length).toBeGreaterThan(0);
    for (const route of protectedRoutes) {
      for (const cookie of [undefined, 'chronos.session_token=forged.value']) {
        const res = await h.app.inject({
          method: route.method,
          url: route.path.replace(/\{[a-zA-Z]+\}/g, '00000000-0000-7000-8000-000000000000'),
          headers: cookie ? { cookie } : {},
        });
        expect(res.statusCode, `${route.id} with ${cookie ?? 'no cookie'}`).toBe(401);
        expect(ErrorResponse.parse(json(res)).error.code).toBe('UNAUTHENTICATED');
      }
    }
  });

  it('admin routes refuse players (403) and accept admins', async () => {
    const address = email();
    const cookie = await createVerifiedAccount(h, address);
    const asPlayer = await h.app.inject({ method: 'GET', url: '/test/admin-probe', headers: { cookie } });
    expect(asPlayer.statusCode).toBe(403);
    expect(ErrorResponse.parse(json(asPlayer)).error.code).toBe('FORBIDDEN');
    await h.sql(`update auth."user" set role = 'admin' where email = $1`, [address]);
    const asAdmin = await h.app.inject({ method: 'GET', url: '/test/admin-probe', headers: { cookie } });
    expect(asAdmin.statusCode).toBe(200);
  });

  it('a user cannot make themselves admin through sign-up or profile updates', async () => {
    const address = email();
    // Sign-up ignores the field (`input: false`); what matters is the stored role.
    await authPost(h.app, '/sign-up/email', { email: address, password: PASSWORD, name: 'C', role: 'admin' });
    const [row] = await h.sql<{ role: string }>('select role from auth."user" where email = $1', [address]);
    expect(row?.role).toBe('player');
    const cookie = await createVerifiedAccount(h, email());
    const update = await authPost(h.app, '/update-user', { role: 'admin' }, { cookie });
    expect(update.statusCode).toBe(400);
    expect(json(update).code).toBe('FIELD_NOT_ALLOWED');
    expect(json(await getAccount(h.app, cookie)).role).toBe('player');
  });

  it('the typed client reaches /account with the session cookie (custom fetch, as on native)', async () => {
    const cookie = await createVerifiedAccount(h, email());
    const base = await h.app.listen({ host: '127.0.0.1', port: 0 });
    try {
      const withCookie = createApiClient({
        baseUrl: base,
        newIdempotencyKey: () => randomUUID(),
        fetch: (input, init) =>
          fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string>), cookie } }),
      });
      const me = await withCookie.call(accountRoute, {});
      expect(me.status).toBe(200);
      expect(me.body.role).toBe('player');
      const anonymous = createApiClient({ baseUrl: base, newIdempotencyKey: () => randomUUID() });
      const error = await anonymous.call(accountRoute, {}).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiClientError);
      expect(error).toMatchObject({ code: 'UNAUTHENTICATED', status: 401 });
    } finally {
      await new Promise<void>((resolve) => {
        h.app.server.close(() => {
          resolve();
        });
      });
    }
  });
});

describe('password reset', () => {
  it('emails a link, sets the new password, revokes old sessions, and the link works once', async () => {
    const address = email();
    const oldCookie = await createVerifiedAccount(h, address);
    const request = await authPost(h.app, '/request-password-reset', {
      email: address,
      redirectTo: `${WEB_ORIGIN}/reset-password`,
    });
    expect(request.statusCode).toBe(200);
    const link = h.mailer.last(address, 'reset-password')?.link ?? '';
    const follow = await h.app.inject({ method: 'GET', url: new URL(link).pathname + new URL(link).search });
    expect(follow.statusCode).toBe(302);
    const target = new URL(follow.headers.location as string);
    expect(target.origin + target.pathname).toBe(`${WEB_ORIGIN}/reset-password`);
    const token = target.searchParams.get('token') ?? '';
    expect(token).not.toBe('');

    const reset = await authPost(h.app, '/reset-password', { token, newPassword: 'a brand new passphrase' });
    expect(reset.statusCode).toBe(200);
    expect((await getAccount(h.app, oldCookie)).statusCode).toBe(401); // every device signed out
    const oldPw = await authPost(h.app, '/sign-in/email', { email: address, password: PASSWORD });
    expect(oldPw.statusCode).toBe(401);
    const newPw = await authPost(h.app, '/sign-in/email', {
      email: address,
      password: 'a brand new passphrase',
    });
    expect(newPw.statusCode).toBe(200);
    const again = await authPost(h.app, '/reset-password', { token, newPassword: 'yet another passphrase' });
    expect(authErrorCode(json(again).code as string, again.statusCode)).toBe('AUTH_TOKEN_INVALID');
  });

  it('answers the same for an unknown email and sends nothing', async () => {
    const known = email();
    await createVerifiedAccount(h, known);
    const unknown = email();
    const a = await authPost(h.app, '/request-password-reset', {
      email: known,
      redirectTo: `${WEB_ORIGIN}/reset-password`,
    });
    const b = await authPost(h.app, '/request-password-reset', {
      email: unknown,
      redirectTo: `${WEB_ORIGIN}/reset-password`,
    });
    expect(b.statusCode).toBe(a.statusCode);
    expect(json(b)).toEqual(json(a));
    expect(h.mailer.sent.some((m) => m.to === unknown)).toBe(false);
  });

  it('refuses a reset redirect to an untrusted site (no token leak to attackers)', async () => {
    const address = email();
    await createVerifiedAccount(h, address);
    const res = await authPost(h.app, '/request-password-reset', {
      email: address,
      redirectTo: 'https://evil.example/steal',
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('account deletion', () => {
  it('needs the password, runs the deletion hooks first, removes everything, and is safe to repeat', async () => {
    const address = email();
    const cookie = await createVerifiedAccount(h, address);
    const [user] = await h.sql<{ id: string }>('select id from auth."user" where email = $1', [address]);
    const accountId = user?.id ?? '';

    const noPassword = await authPost(h.app, '/delete-user', {}, { cookie });
    expect(noPassword.statusCode).toBe(400);
    const wrongPassword = await authPost(h.app, '/delete-user', { password: 'not my password' }, { cookie });
    expect(authErrorCode(json(wrongPassword).code as string, wrongPassword.statusCode)).toBe(
      'AUTH_INVALID_CREDENTIALS',
    );
    expect(await h.sql('select 1 from auth."user" where id = $1', [accountId])).toHaveLength(1);

    const deleted = await authPost(h.app, '/delete-user', { password: PASSWORD }, { cookie });
    expect(deleted.statusCode).toBe(200);
    expect(deletionCalls).toContainEqual({ accountId, userStillExisted: true });
    const leftovers = await h.sql<{ n: string }>(
      `select (select count(*) from auth."user" where id = $1)
            + (select count(*) from auth.session where user_id = $1)
            + (select count(*) from auth.account where user_id = $1) as n`,
      [accountId],
    );
    expect(Number(leftovers[0]?.n)).toBe(0);
    expect((await getAccount(h.app, cookie)).statusCode).toBe(401);
    const again = await authPost(h.app, '/delete-user', { password: PASSWORD }, { cookie });
    expect(again.statusCode).toBe(401); // already gone: nothing else happens
    // The address is free again (a new account can be created with it).
    await createVerifiedAccount(h, address);
  });
});

describe('rate limits on auth endpoints', () => {
  it('limits sign-in attempts per client IP; a spoofed IP header does not reset the counter', async () => {
    const limited = await makeAuthApp(t.url, { rateLimit: true });
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 7; i++) {
        const res = await authPost(
          limited.app,
          '/sign-in/email',
          { email: 'nobody@example.com', password: 'wrong password!' },
          { 'x-chronos-client-ip': `203.0.113.${String(i)}` },
        );
        statuses.push(res.statusCode);
      }
      expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(statuses.slice(5)).toEqual([429, 429]);
    } finally {
      await limited.close();
    }
  });
});

describe('cookies over https', () => {
  it('uses __Secure- cookies with the Secure flag when the API URL is https', async () => {
    const secure = await makeAuthApp(t.url, { baseUrl: 'https://api.example.test' });
    try {
      const address = email();
      await authPost(secure.app, '/sign-up/email', {
        email: address,
        password: PASSWORD,
        name: 'C',
        callbackURL: `${WEB_ORIGIN}/`,
      });
      const link = secure.mailer.last(address, 'verify-email')?.link ?? '';
      const verified = await secure.app.inject({
        method: 'GET',
        url: new URL(link).pathname + new URL(link).search,
      });
      const setCookie = [verified.headers['set-cookie']].flat().join('\n');
      expect(setCookie).toMatch(/__Secure-chronos\.session_token=[^;]+;.*Secure/);
    } finally {
      await secure.close();
    }
  });
});

describe('module wiring', () => {
  it('the production modules bind every contract', () => {
    const ids = [...systemModule({ database: up, redis: up }, { shuttingDown: false }), ...accountModule()]
      .map((b) => b.contract.id)
      .sort();
    expect(ids).toEqual(routes.map((r) => r.id).sort());
  });
});
