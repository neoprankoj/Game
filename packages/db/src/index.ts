// @chronos/db — persistence layer (ADR-0006, DATABASE_DESIGN). No game rules live here.
export { createDatabase, type Database, type DatabaseOptions } from './client';
export { readDatabaseUrl } from './env';
export { isRetryableTransactionError, LockOrderViolation, RETRYABLE_SQLSTATES, sqlState } from './errors';
export { LockOrder, LockRank, lockRows, type LockRowsSpec, type LockStrength, type LockWait } from './locks';
export { MIGRATIONS_FOLDER, runMigrations } from './migrate';
export type { IsolationLevel, TransactionContext, TransactionOptions } from './transaction';
export type { Tx } from './types';
