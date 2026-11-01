import { sql } from 'drizzle-orm';
import { LockOrderViolation } from './errors';
import type { Tx } from './types';

/**
 * Canonical lock ranks (DATABASE_DESIGN §5.2). A transaction acquires locks only in increasing rank,
 * and within a rank in ascending id order. This makes deadlocks among game operations impossible by construction.
 */
export const LockRank = {
  idempotencyKey: 0,
  playerRoot: 1,
  outpostRoot: 2,
  island: 3,
  region: 4,
  leaf: 5,
} as const;
export type LockRank = (typeof LockRank)[keyof typeof LockRank];

/** Row lock strengths. `no key update` is the default for root locks (DATABASE_DESIGN §5.1). */
export type LockStrength = 'update' | 'no key update' | 'share' | 'key share';
export type LockWait = 'wait' | 'skip locked' | 'nowait';
type Id = string | bigint;

const compareIds = (a: Id, b: Id): number => {
  if (typeof a === 'bigint' && typeof b === 'bigint') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0; // lowercase uuid text order = byte order
  throw new TypeError('lock ids within one request must all be strings (uuid) or all bigint');
};

/** Tracks the locks taken inside one transaction attempt and rejects out-of-order acquisition. */
export class LockOrder {
  private rank = -1;
  private lastId: Id | undefined;

  /** Validates (and records) acquiring `ids` (already sorted ascending) at `rank`. */
  enter(rank: LockRank, sortedIds: readonly Id[], label: string): void {
    const first = sortedIds[0];
    const last = sortedIds[sortedIds.length - 1];
    if (first === undefined || last === undefined) return;
    if (rank < this.rank) {
      throw new LockOrderViolation(
        `${label}: rank ${String(rank)} requested after rank ${String(this.rank)}`,
      );
    }
    if (rank === this.rank && this.lastId !== undefined && compareIds(first, this.lastId) <= 0) {
      throw new LockOrderViolation(
        `${label}: id ${String(first)} not above already-locked ${String(this.lastId)}`,
      );
    }
    this.rank = rank;
    this.lastId = last;
  }
}

export interface LockRowsSpec {
  rank: LockRank;
  schema: string;
  table: string;
  ids: readonly Id[];
  idColumn?: string;
  strength?: LockStrength;
  wait?: LockWait;
}

/**
 * Locks rows by id in canonical (ascending) order and returns the ids actually locked
 * (fewer than requested if rows are missing or, with `skip locked`, busy).
 */
export async function lockRows(tx: Tx, order: LockOrder, spec: LockRowsSpec): Promise<Id[]> {
  const { rank, schema, table, idColumn = 'id', strength = 'no key update', wait = 'wait' } = spec;
  const ids = [...new Set(spec.ids)].sort(compareIds);
  if (ids.length === 0) return [];
  order.enter(rank, ids, `${schema}.${table}`);
  const column = sql.identifier(idColumn);
  const waitClause = wait === 'wait' ? sql`` : sql.raw(` ${wait}`);
  const result = await tx.execute<{ id: Id }>(
    sql`select ${column} as id from ${sql.identifier(schema)}.${sql.identifier(table)}
        where ${column} in (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )})
        order by ${column} for ${sql.raw(strength)}${waitClause}`,
  );
  return result.rows.map((row) => row.id);
}
