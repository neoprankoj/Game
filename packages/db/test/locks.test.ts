import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { LockOrder, LockOrderViolation, LockRank, lockRows, sqlState } from '../src';
import { useTestDatabase } from '../src/testing';
import { deferred } from './helpers';

const t = useTestDatabase();
const A = '018f0000-0000-7000-8000-00000000000a';
const B = '018f0000-0000-7000-8000-00000000000b';
const C = '018f0000-0000-7000-8000-00000000000c';
const root = (ids: string[], extra: Partial<Parameters<typeof lockRows>[2]> = {}) => ({
  rank: LockRank.playerRoot,
  schema: 'game',
  table: 'roots',
  ids,
  ...extra,
});

beforeAll(async () => {
  await t.db.withTransaction(async (tx) => {
    await tx.execute(sql`create table game.roots (id uuid primary key)`);
    await tx.execute(sql`insert into game.roots values (${A}), (${B}), (${C})`);
  });
});

describe('lockRows against PostgreSQL', () => {
  it('locks rows in ascending order and returns the locked ids (missing rows skipped)', async () => {
    const missing = '018f0000-0000-7000-8000-0000000000ff';
    const locked = await t.db.withTransaction((tx, ctx) => lockRows(tx, ctx.locks, root([C, missing, A])));
    expect(locked).toEqual([A, C]);
  });

  it('serialises two transactions that lock the same root (the second waits for the first to commit)', async () => {
    const events: string[] = [];
    const firstHolds = deferred();
    const first = t.db.withTransaction(async (tx, ctx) => {
      await lockRows(tx, ctx.locks, root([A]));
      events.push('first locked');
      firstHolds.resolve();
      await new Promise((r) => setTimeout(r, 300));
      events.push('first commits');
    });
    await firstHolds.promise;
    const second = t.db.withTransaction(async (tx, ctx) => {
      await lockRows(tx, ctx.locks, root([A]));
      events.push('second locked');
    });
    await Promise.all([first, second]);
    expect(events).toEqual(['first locked', 'first commits', 'second locked']);
  });

  it('SKIP LOCKED returns nothing for a busy row instead of waiting (reconciler pattern)', async () => {
    const held = deferred();
    const release = deferred();
    const holder = t.db.withTransaction(async (tx, ctx) => {
      await lockRows(tx, ctx.locks, root([B]));
      held.resolve();
      await release.promise;
    });
    await held.promise;
    const got = await t.db.withTransaction((tx, ctx) =>
      lockRows(tx, ctx.locks, root([B], { wait: 'skip locked' })),
    );
    release.resolve();
    await holder;
    expect(got).toEqual([]);
  });

  it('NOWAIT fails immediately with lock_not_available (55P03)', async () => {
    const held = deferred();
    const release = deferred();
    const holder = t.db.withTransaction(async (tx, ctx) => {
      await lockRows(tx, ctx.locks, root([C]));
      held.resolve();
      await release.promise;
    });
    await held.promise;
    const error = await t.db
      .withTransaction((tx, ctx) => lockRows(tx, ctx.locks, root([C], { wait: 'nowait' })), {
        maxAttempts: 1,
      })
      .catch((e: unknown) => e);
    release.resolve();
    await holder;
    expect(sqlState(error)).toBe('55P03');
  });

  it('rejects out-of-order acquisition before touching the database', async () => {
    const error = await t.db
      .withTransaction(async (tx, ctx) => {
        await lockRows(tx, ctx.locks, root([C]));
        await lockRows(tx, ctx.locks, root([A])); // same rank, lower id → would risk deadlock
      })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LockOrderViolation);
  });
});

describe('LockOrder (DATABASE_DESIGN §5.2)', () => {
  it('accepts increasing ranks and ascending ids within a rank', () => {
    const order = new LockOrder();
    expect(() => {
      order.enter(LockRank.idempotencyKey, ['k'], 'key');
      order.enter(LockRank.playerRoot, [A, B], 'players');
      order.enter(LockRank.playerRoot, [C], 'players');
      order.enter(LockRank.outpostRoot, [A], 'outposts');
      order.enter(LockRank.leaf, [1n, 2n], 'cursors');
    }).not.toThrow();
  });

  it('rejects a lower rank after a higher one', () => {
    const order = new LockOrder();
    order.enter(LockRank.outpostRoot, [B], 'outposts');
    expect(() => {
      order.enter(LockRank.playerRoot, [A], 'players');
    }).toThrow(LockOrderViolation);
  });

  it('rejects a non-ascending id within the same rank', () => {
    const order = new LockOrder();
    order.enter(LockRank.playerRoot, [B], 'players');
    expect(() => {
      order.enter(LockRank.playerRoot, [A], 'players');
    }).toThrow(LockOrderViolation);
    expect(() => {
      order.enter(LockRank.playerRoot, [B], 'players');
    }).toThrow(LockOrderViolation);
  });
});
