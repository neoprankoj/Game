import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema';

/** The Drizzle database bound to this project's schema. Internal: callers get transactions, not this. */
export type Db = NodePgDatabase<typeof schema>;

/** A transaction handle. Repositories take `tx: Tx` explicitly (ADR-0006: no implicit global connection). */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
