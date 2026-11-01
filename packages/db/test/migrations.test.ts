import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER, runMigrations } from '../src';
import { createEmptyDatabase, dropDatabase, testAdminUrl, useTestDatabase } from '../src/testing';

const journal = JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf8')) as {
  entries: unknown[];
};
const t = useTestDatabase();
const extra: string[] = [];
afterAll(async () => {
  for (const name of extra) await dropDatabase(testAdminUrl(), name);
});

async function query<T extends pg.QueryResultRow>(url: string, text: string): Promise<T[]> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query<T>(text)).rows;
  } finally {
    await client.end();
  }
}

describe('migrations', () => {
  it('run up on an EMPTY database, even when two runs start at the same time', async () => {
    const name = `${t.name}_empty`;
    extra.push(name);
    const url = await createEmptyDatabase(testAdminUrl(), name);
    await Promise.all([runMigrations(url), runMigrations(url)]); // advisory lock serialises them
    const applied = await query<{ n: string }>(url, 'select count(*) as n from drizzle.__migrations');
    expect(Number(applied[0]?.n)).toBe(journal.entries.length);
    const schemas = await query<{ nspname: string }>(
      url,
      "select nspname from pg_namespace where nspname in ('game', 'platform') order by nspname",
    );
    expect(schemas.map((s) => s.nspname)).toEqual(['game', 'platform']);
  });

  it('are a no-op when re-run on an up-to-date database', async () => {
    await runMigrations(t.url);
    const applied = await query<{ n: string }>(t.url, 'select count(*) as n from drizzle.__migrations');
    expect(Number(applied[0]?.n)).toBe(journal.entries.length);
  });

  it('install the append-only guard used by ledger, battles and audit tables', async () => {
    const client = new pg.Client({ connectionString: t.url });
    await client.connect();
    try {
      await client.query('create table public.appendonly (x int)');
      await client.query(
        'create trigger g before update or delete on public.appendonly for each row execute function platform.forbid_update_delete()',
      );
      await client.query('insert into public.appendonly values (1)');
      const update = await client.query('update public.appendonly set x = 2').catch((e: unknown) => e);
      const del = await client.query('delete from public.appendonly').catch((e: unknown) => e);
      expect((update as { code?: string }).code).toBe('42501');
      expect((del as { code?: string }).code).toBe('42501');
    } finally {
      await client.end();
    }
  });
});
