import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { sqlState } from '../src';
import { useTestDatabase } from '../src/testing';
import { deferred, pgError } from './helpers';

const t = useTestDatabase();
const noSleep = { sleep: () => Promise.resolve(), backoffMs: () => 0 };

beforeAll(async () => {
  await t.db.withTransaction(async (tx) => {
    await tx.execute(sql`create table public.items (id int primary key, label text not null)`);
    await tx.execute(sql`create table public.counter (id int primary key, n int not null)`);
    await tx.execute(sql`insert into public.counter values (1, 0), (10, 0), (11, 0)`);
  });
});

const count = (): Promise<number> =>
  t.db.withTransaction(async (tx) => {
    const r = await tx.execute<{ n: bigint }>(sql`select count(*) as n from public.items`);
    return Number(r.rows[0]?.n);
  });

describe('withTransaction: commit and rollback', () => {
  it('commits all writes of the body', async () => {
    await t.db.withTransaction(async (tx) => {
      await tx.execute(sql`insert into public.items values (1, 'a'), (2, 'b')`);
    });
    expect(await count()).toBe(2);
  });

  it('rolls back every write when the body throws (no partial state)', async () => {
    await expect(
      t.db.withTransaction(async (tx) => {
        await tx.execute(sql`insert into public.items values (3, 'c')`);
        throw new Error('domain validation failed');
      }),
    ).rejects.toThrow('domain validation failed');
    expect(await count()).toBe(2);
  });

  it('rolls back when a statement fails midway (constraint violation)', async () => {
    const error = await t.db
      .withTransaction(async (tx) => {
        await tx.execute(sql`insert into public.items values (4, 'd')`);
        await tx.execute(sql`insert into public.items values (1, 'duplicate')`);
      })
      .catch((e: unknown) => e);
    expect(sqlState(error)).toBe('23505');
    expect(await count()).toBe(2);
  });

  it('runs READ COMMITTED by default, in UTC, with the configured timeouts', async () => {
    const settings = await t.db.withTransaction(
      async (tx) =>
        (
          await tx.execute<{ iso: string; tz: string; lt: string; st: string }>(
            sql`select current_setting('transaction_isolation') as iso, current_setting('TimeZone') as tz,
                       current_setting('lock_timeout') as lt, current_setting('statement_timeout') as st`,
          )
        ).rows[0],
      { lockTimeoutMs: 1500, statementTimeoutMs: 4000 },
    );
    expect(settings).toEqual({ iso: 'read committed', tz: 'UTC', lt: '1500ms', st: '4s' });
  });

  it('read-only transactions are REPEATABLE READ and reject writes', async () => {
    const iso = await t.db.withReadOnlyTransaction(
      async (tx) =>
        (await tx.execute<{ iso: string }>(sql`select current_setting('transaction_isolation') as iso`))
          .rows[0]?.iso,
    );
    expect(iso).toBe('repeatable read');
    const error = await t.db
      .withReadOnlyTransaction((tx) => tx.execute(sql`insert into public.items values (9, 'x')`))
      .catch((e: unknown) => e);
    expect(sqlState(error)).toBe('25006');
  });
});

describe('withTransaction: retry policy (simulated failures)', () => {
  it.each(['40001', '40P01', '55P03'])('retries the whole transaction after SQLSTATE %s', async (code) => {
    const attempts: number[] = [];
    const retries: (string | undefined)[] = [];
    const result = await t.db.withTransaction(
      (_tx, ctx) => {
        attempts.push(ctx.attempt);
        return ctx.attempt === 1 ? Promise.reject(pgError(code)) : Promise.resolve('ok');
      },
      { ...noSleep, onRetry: (info) => retries.push(info.sqlState) },
    );
    expect(result).toBe('ok');
    expect(attempts).toEqual([1, 2]);
    expect(retries).toEqual([code]);
  });

  it('finds the SQLSTATE through wrapped errors (Drizzle `cause` chain)', async () => {
    let calls = 0;
    await t.db.withTransaction(() => {
      calls++;
      return calls === 1
        ? Promise.reject(new Error('wrapped', { cause: pgError('40001') }))
        : Promise.resolve();
    }, noSleep);
    expect(calls).toBe(2);
  });

  it('does not retry non-retryable errors', async () => {
    let calls = 0;
    await expect(
      t.db.withTransaction(() => {
        calls++;
        return Promise.reject(pgError('23505'));
      }, noSleep),
    ).rejects.toThrow('simulated 23505');
    expect(calls).toBe(1);
  });

  it('gives up after maxAttempts and rethrows the last error', async () => {
    let calls = 0;
    const error = await t.db
      .withTransaction(
        () => {
          calls++;
          return Promise.reject(pgError('40001'));
        },
        { ...noSleep, maxAttempts: 4 },
      )
      .catch((e: unknown) => e);
    expect(calls).toBe(4);
    expect(sqlState(error)).toBe('40001');
  });

  it('does not retry a statement timeout (57014): slow queries are bugs, not contention', async () => {
    let calls = 0;
    const error = await t.db
      .withTransaction(
        async (tx) => {
          calls++;
          await tx.execute(sql`select pg_sleep(1)`);
        },
        { ...noSleep, statementTimeoutMs: 100 },
      )
      .catch((e: unknown) => e);
    expect(sqlState(error)).toBe('57014');
    expect(calls).toBe(1);
  });
});

describe('withTransaction: real contention on PostgreSQL 18', () => {
  it('recovers from a genuine serialization failure (SERIALIZABLE, concurrent increments)', async () => {
    const bothRead = { a: deferred(), b: deferred() };
    const retries: (string | undefined)[] = [];
    const increment = (me: 'a' | 'b', other: 'a' | 'b') =>
      t.db.withTransaction(
        async (tx, ctx) => {
          const r = await tx.execute<{ n: number }>(sql`select n from public.counter where id = 1`);
          if (ctx.attempt === 1) {
            bothRead[me].resolve();
            await bothRead[other].promise; // both have read the old value → write skew
          }
          await tx.execute(sql`update public.counter set n = ${(r.rows[0]?.n ?? 0) + 1} where id = 1`);
        },
        { isolation: 'serializable', onRetry: (i) => retries.push(i.sqlState) },
      );
    await Promise.all([increment('a', 'b'), increment('b', 'a')]);
    const n = await t.db.withTransaction(
      async (tx) =>
        (await tx.execute<{ n: number }>(sql`select n from public.counter where id = 1`)).rows[0]?.n,
    );
    expect(n).toBe(2); // no lost update
    expect(retries).toContain('40001');
  });

  it('recovers from a genuine deadlock (rows locked in opposite order)', async () => {
    const gate = { a: deferred(), b: deferred() };
    const retries: (string | undefined)[] = [];
    const run = (first: number, second: number, me: 'a' | 'b', other: 'a' | 'b') =>
      t.db.withTransaction(
        async (tx, ctx) => {
          await tx.execute(sql`update public.counter set n = n + 1 where id = ${first}`);
          if (ctx.attempt === 1) {
            gate[me].resolve();
            await gate[other].promise;
          }
          await tx.execute(sql`update public.counter set n = n + 1 where id = ${second}`);
        },
        { lockTimeoutMs: 10_000, onRetry: (i) => retries.push(i.sqlState) },
      );
    await Promise.all([run(10, 11, 'a', 'b'), run(11, 10, 'b', 'a')]);
    expect(retries).toEqual(['40P01']); // PostgreSQL aborted exactly one victim, which was retried
    const rows = await t.db.withTransaction(
      async (tx) =>
        (await tx.execute<{ n: number }>(sql`select n from public.counter where id in (10, 11) order by id`))
          .rows,
    );
    expect(rows.map((r) => r.n)).toEqual([2, 2]); // each row incremented once by each transaction
  });
});
