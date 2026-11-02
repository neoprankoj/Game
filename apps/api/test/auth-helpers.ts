import { createDatabase, type Database } from '@chronos/db';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import pg from 'pg';
import { buildApp, type BuildAppOptions } from '../src/app';
import { MemoryMailer } from '../src/auth/mailer';
import type { AccountDeletionHook } from '../src/auth/service';
import { EXAMPLE_AUTH_SECRET } from '../src/config';
import { createAuthDatabase } from '../src/deps';
import { testConfig, up } from './helpers';

export const WEB_ORIGIN = 'http://localhost:8081';
export const PASSWORD = 'correct horse battery';

export interface AuthHarness {
  app: FastifyInstance;
  mailer: MemoryMailer;
  sql: <T extends pg.QueryResultRow>(text: string, values?: unknown[]) => Promise<T[]>;
  close(): Promise<void>;
}

/** A full API (real Better Auth, real test database, in-memory mailer, fake Redis). */
export async function makeAuthApp(
  databaseUrl: string,
  options: {
    rateLimit?: boolean;
    baseUrl?: string;
    deletionHooks?: AccountDeletionHook[];
    extra?: Partial<BuildAppOptions>;
  } = {},
): Promise<AuthHarness> {
  const database: Database = createDatabase({ url: databaseUrl, maxConnections: 4 });
  const mailer = new MemoryMailer();
  const app = await buildApp({
    config: testConfig,
    deps: { database: up, redis: up },
    logger: false,
    auth: {
      config: {
        secret: EXAMPLE_AUTH_SECRET,
        baseUrl: options.baseUrl ?? 'http://localhost:3000',
        rateLimit: options.rateLimit ?? false,
      },
      database: createAuthDatabase(database),
      mailer,
      ...(options.deletionHooks ? { deletionHooks: options.deletionHooks } : {}),
    },
    ...options.extra,
  });
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  return {
    app,
    mailer,
    sql: async <T extends pg.QueryResultRow>(text: string, values?: unknown[]) =>
      (await pool.query<T>(text, values)).rows,
    close: async () => {
      await app.close();
      await pool.end();
      await database.close();
    },
  };
}

/** `name=value` pairs from Set-Cookie headers, ready to send back in a Cookie header. */
export function cookiesOf(response: LightMyRequestResponse): string {
  const raw = response.headers['set-cookie'];
  const list = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  return list
    .map((c) => c.split(';')[0] ?? '')
    .filter((c) => c.length > 0 && !c.endsWith('='))
    .join('; ');
}

export const json = (response: LightMyRequestResponse): Record<string, unknown> =>
  response.json<Record<string, unknown>>();

/** Browser-like call to a Better Auth endpoint (the web client sends its Origin). */
export function authPost(
  app: FastifyInstance,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: `/api/auth${path}`,
    headers: { origin: WEB_ORIGIN, 'content-type': 'application/json', ...headers },
    payload: JSON.stringify(body),
  });
}

/** Signs up, follows the verification link from the email and returns the session cookie. */
export async function createVerifiedAccount(
  h: AuthHarness,
  email: string,
  password = PASSWORD,
): Promise<string> {
  const signUp = await authPost(h.app, '/sign-up/email', {
    email,
    password,
    name: 'Commander',
    callbackURL: `${WEB_ORIGIN}/`,
  });
  if (signUp.statusCode !== 200) throw new Error(`sign-up failed: ${signUp.body}`);
  const link = h.mailer.last(email.toLowerCase(), 'verify-email')?.link;
  if (!link) throw new Error('no verification email');
  const verified = await h.app.inject({ method: 'GET', url: new URL(link).pathname + new URL(link).search });
  if (verified.statusCode !== 302)
    throw new Error(`verification failed: ${String(verified.statusCode)} ${verified.body}`);
  return cookiesOf(verified);
}

export const getAccount = (app: FastifyInstance, cookie?: string) =>
  app.inject({ method: 'GET', url: '/account', headers: cookie ? { cookie } : {} });
