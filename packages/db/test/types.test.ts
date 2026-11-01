import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../src/testing';

const t = useTestDatabase();

describe('value mapping (ADR-0006)', () => {
  it('reads int8 as bigint and round-trips values above 2^53 exactly', async () => {
    const big = 9_223_372_036_854_775_807n; // int8 max
    const row = await t.db.withTransaction(async (tx) => {
      await tx.execute(sql`create table public.amounts (v bigint not null)`);
      await tx.execute(sql`insert into public.amounts values (${big.toString()}::bigint)`);
      return (await tx.execute<{ v: bigint; w: bigint }>(sql`select v, v - 1 as w from public.amounts`))
        .rows[0];
    });
    expect(row?.v).toBe(big);
    expect(row?.w).toBe(big - 1n);
    expect(typeof row?.v).toBe('bigint');
    expect(2n ** 53n + 1n).toBe(9_007_199_254_740_993n); // a value Number cannot represent, for the record
  });

  it('isolates each test file in its own cloned database', async () => {
    const name = await t.db.withTransaction(
      async (tx) => (await tx.execute<{ d: string }>(sql`select current_database() as d`)).rows[0]?.d,
    );
    expect(name).toBe(t.name);
    expect(name).toMatch(/^chronos_t_db_[0-9a-f]{12}$/);
  });
});
