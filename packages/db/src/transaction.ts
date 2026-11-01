import { sql } from 'drizzle-orm';
import { isRetryableTransactionError, sqlState } from './errors';
import { LockOrder } from './locks';
import type { Db, Tx } from './types';

export type IsolationLevel = 'read committed' | 'repeatable read' | 'serializable';

export interface TransactionOptions {
  /** Default `read committed` (DATABASE_DESIGN §5.4); correctness comes from explicit row locks. */
  isolation?: IsolationLevel;
  readOnly?: boolean;
  /** `SET LOCAL lock_timeout` in ms. Default 2000 (request paths); workers pass 5000. */
  lockTimeoutMs?: number;
  /** `SET LOCAL statement_timeout` in ms. Default 5000 (request paths); workers pass 30000. */
  statementTimeoutMs?: number;
  /** Total attempts including the first. Default 3. */
  maxAttempts?: number;
  /** Called before each retry (logging/metrics). */
  onRetry?: (info: { attempt: number; sqlState: string | undefined; delayMs: number }) => void;
  /** Backoff before attempt n+1. Default: 20ms × 2^(n−1) + up to 20ms jitter. */
  backoffMs?: (attempt: number) => number;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
}

/** Per-attempt context handed to the transaction body. */
export interface TransactionContext {
  /** 1 on the first try, 2 on the first retry, … */
  attempt: number;
  /** Lock-order guard for `lockRows` (DATABASE_DESIGN §5.2). Fresh for every attempt. */
  locks: LockOrder;
}

const defaultBackoff = (attempt: number): number => 20 * 2 ** (attempt - 1) + Math.floor(Math.random() * 20);
const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `body` in a transaction and retries the WHOLE transaction on serialization failure, deadlock or
 * lock timeout (DATABASE_DESIGN §5.2). The body must therefore have no side effects outside the
 * database. External effects go through the outbox (SYSTEM_ARCHITECTURE §4.4).
 */
export async function runTransaction<T>(
  db: Db,
  body: (tx: Tx, context: TransactionContext) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const {
    isolation = 'read committed',
    readOnly = false,
    lockTimeoutMs = 2000,
    statementTimeoutMs = 5000,
    maxAttempts = 3,
    onRetry,
    backoffMs = defaultBackoff,
    sleep = defaultSleep,
  } = options;

  for (let attempt = 1; ; attempt++) {
    try {
      return await db.transaction(
        async (tx) => {
          await tx.execute(
            sql`select set_config('lock_timeout', ${`${String(lockTimeoutMs)}ms`}, true),
                       set_config('statement_timeout', ${`${String(statementTimeoutMs)}ms`}, true)`,
          );
          return body(tx, { attempt, locks: new LockOrder() });
        },
        { isolationLevel: isolation, accessMode: readOnly ? 'read only' : 'read write' },
      );
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableTransactionError(error)) throw error;
      const delayMs = backoffMs(attempt);
      onRetry?.({ attempt, sqlState: sqlState(error), delayMs });
      await sleep(delayMs);
    }
  }
}
