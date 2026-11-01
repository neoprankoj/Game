import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { runTransaction, type TransactionContext, type TransactionOptions } from './transaction';
import type { Db, Tx } from './types';

export interface DatabaseOptions {
  url: string;
  /** Pool size. Default 10. */
  maxConnections?: number;
  /** Shown in pg_stat_activity: which app or worker holds a connection. */
  applicationName?: string;
  /**
   * Called when the server closes an IDLE pooled connection (restart, failover, idle reaping, admin kill).
   * pg drops that client and the next query opens a new one, so this is informational: log it.
   * Without a listener node-postgres raises an unhandled 'error' event that would crash the process
   * (found in Part 2.5; test/resilience.test.ts).
   */
  onIdleClientError?: (error: Error) => void;
}

/**
 * The only handle apps receive. It exposes transactions, not a raw connection: every write goes through
 * `withTransaction` (Part 2.3 "Done when"). Repositories receive the `tx`.
 */
export interface Database {
  withTransaction<T>(
    body: (tx: Tx, context: TransactionContext) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T>;
  /** REPEATABLE READ, READ ONLY: consistent multi-table reads without locks (DATABASE_DESIGN §5.4). */
  withReadOnlyTransaction<T>(
    body: (tx: Tx, context: TransactionContext) => Promise<T>,
    options?: Omit<TransactionOptions, 'readOnly' | 'isolation'>,
  ): Promise<T>;
  /** Readiness probe (`/ready`, Part 2.5). */
  ping(): Promise<void>;
  close(): Promise<void>;
}

/**
 * int8 → bigint, never a lossy number or a string (ADR-0006: resource amounts are bigint).
 * Registered on pg's GLOBAL type registry on purpose: Drizzle's node-postgres driver passes its own
 * per-query type config that falls back to the global parsers, so a pool-level override is silently
 * ignored (found by test/types.test.ts in Part 2.3). Every pg user in the process gets bigint for int8.
 */
pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => BigInt(value));

export function createDatabase(options: DatabaseOptions): Database {
  const pool = new pg.Pool({
    connectionString: options.url,
    max: options.maxConnections ?? 10,
    application_name: options.applicationName ?? 'chronos',
    // Every session runs in UTC (rule 5), whatever the server default is.
    options: '-c timezone=UTC',
  });
  pool.on('error', (error) => {
    options.onIdleClientError?.(error);
  });
  const db: Db = drizzle(pool, { schema });

  return {
    withTransaction: (body, opts) => runTransaction(db, body, opts),
    withReadOnlyTransaction: (body, opts) =>
      runTransaction(db, body, { ...opts, isolation: 'repeatable read', readOnly: true }),
    ping: async () => {
      await db.execute(sql`select 1`);
    },
    close: () => pool.end(),
  };
}
