import { sql } from 'drizzle-orm';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { createDatabase, sqlState } from '../src';
import { useTestDatabase } from '../src/testing';

const t = useTestDatabase();

describe('connection resilience', () => {
  it('survives the server killing an idle pooled connection and reconnects on the next query', async () => {
    const seen: Error[] = [];
    const db = createDatabase({
      url: t.url,
      applicationName: 'resilience-victim',
      onIdleClientError: (e) => seen.push(e),
    });
    try {
      await db.ping(); // a connection now sits idle in the pool
      const admin = new pg.Client({ connectionString: t.url });
      await admin.connect();
      const killed = await admin.query<{ n: string }>(
        "select count(pg_terminate_backend(pid)) as n from pg_stat_activity where application_name = 'resilience-victim'",
      );
      await admin.end();
      expect(Number(killed.rows[0]?.n)).toBe(1);
      await new Promise((r) => setTimeout(r, 200)); // let the FATAL reach the idle client
      expect(seen.map((e) => sqlState(e))).toEqual(['57P01']); // reported, not thrown: the process is still alive
      const value = await db.withTransaction(
        async (tx) => (await tx.execute<{ v: number }>(sql`select 7 as v`)).rows[0]?.v,
      );
      expect(value).toBe(7); // a fresh connection was opened transparently
    } finally {
      await db.close();
    }
  });
});
