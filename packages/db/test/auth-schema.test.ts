import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../src/testing';

const t = useTestDatabase();
let client: pg.Client;
beforeAll(async () => {
  client = new pg.Client({ connectionString: t.url });
  await client.connect();
});
afterAll(async () => {
  await client.end();
});

const insertUser = (id: string, email: string, role = 'player') =>
  client
    .query(`insert into auth."user" (id, name, email, role) values ($1, 'n', $2, $3)`, [id, email, role])
    .then(
      () => 'ok',
      (e: unknown) =>
        (e as { constraint?: string; code?: string }).constraint ?? (e as { code?: string }).code,
    );

describe('auth schema (Part 2.8)', () => {
  it('stores one account per email, lowercase only (case-insensitive uniqueness)', async () => {
    expect(await insertUser('u1', 'pilot@example.com')).toBe('ok');
    expect(await insertUser('u2', 'pilot@example.com')).toBe('user_email_unique');
    expect(await insertUser('u3', 'Pilot@Example.com')).toBe('user_email_lowercase_check');
  });

  it('allows only the MVP roles', async () => {
    expect(await insertUser('u4', 'admin@example.com', 'admin')).toBe('ok');
    expect(await insertUser('u5', 'x@example.com', 'moderator')).toBe('user_role_check');
    const { rows } = await client.query<{ role: string }>(
      `insert into auth."user" (id, name, email) values ('u6', 'n', 'd@example.com') returning role`,
    );
    expect(rows[0]?.role).toBe('player');
  });

  it('deleting a user removes its sessions and credentials (cascade)', async () => {
    await insertUser('u7', 'gone@example.com');
    await client.query(
      `insert into auth.session (id, expires_at, token, updated_at, user_id) values ('s7', now() + interval '1 day', 'tok7', now(), 'u7')`,
    );
    await client.query(
      `insert into auth.account (id, account_id, provider_id, user_id, updated_at) values ('a7', 'u7', 'credential', 'u7', now())`,
    );
    await client.query(`delete from auth."user" where id = 'u7'`);
    const { rows } = await client.query<{ n: string }>(
      `select (select count(*) from auth.session where user_id = 'u7') + (select count(*) from auth.account where user_id = 'u7') as n`,
    );
    expect(Number(rows[0]?.n)).toBe(0);
  });

  it('stores instants as timestamptz (DATABASE_DESIGN §2)', async () => {
    const { rows } = await client.query<{ n: string }>(
      `select count(*) as n from information_schema.columns
       where table_schema = 'auth' and data_type = 'timestamp without time zone'`,
    );
    expect(Number(rows[0]?.n)).toBe(0);
  });
});

describe('Drizzle schema ↔ committed migrations', () => {
  it('drizzle-kit finds nothing to generate (the schema and the SQL migrations agree)', () => {
    // Generate into a COPY of the migrations folder, so a drifted schema fails the test without writing files.
    const root = fileURLToPath(new URL('..', import.meta.url));
    // drizzle-kit only accepts a RELATIVE --out path, hence a scratch folder inside the package (git-ignored).
    const scratch = mkdtempSync(join(root, '.drizzle-probe-'));
    try {
      cpSync(join(root, 'migrations'), scratch, { recursive: true });
      const before = readdirSync(scratch).length;
      const out = execFileSync(
        'pnpm',
        [
          'exec',
          'drizzle-kit',
          'generate',
          '--dialect',
          'postgresql',
          '--schema',
          './src/schema/index.ts',
          '--out',
          `./${basename(scratch)}`,
        ],
        { cwd: root, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' } },
      );
      expect(out).toMatch(/No schema changes/);
      expect(readdirSync(scratch).length).toBe(before);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 60_000);
});
