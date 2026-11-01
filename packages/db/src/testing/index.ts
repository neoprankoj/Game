// Test helpers for database-backed tests (import from '@chronos/db/testing').
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, inject } from 'vitest';
import { createDatabase, type Database } from '../client';
import { cloneDatabase, dropDatabase } from './test-database';

export { createEmptyDatabase, dropDatabase, urlForDatabase } from './test-database';

export interface TestDatabase {
  /** The isolated database for this test file (migrated). */
  readonly db: Database;
  readonly url: string;
  readonly name: string;
}

/**
 * Gives the calling test file its own migrated database, cloned from the run's template, and drops it
 * afterwards. Test files never share state.
 */
export function useTestDatabase(): TestDatabase {
  const state: { db?: Database; url?: string; name?: string } = {};
  beforeAll(async () => {
    state.name = `${inject('chronosDbPrefix')}${randomBytes(6).toString('hex')}`;
    state.url = await cloneDatabase(inject('chronosDbAdminUrl'), inject('chronosDbTemplate'), state.name);
    state.db = createDatabase({ url: state.url, applicationName: 'chronos-test', maxConnections: 8 });
  });
  afterAll(async () => {
    await state.db?.close();
    if (state.name) await dropDatabase(inject('chronosDbAdminUrl'), state.name);
  });
  const get = <K extends keyof typeof state>(key: K): NonNullable<(typeof state)[K]> => {
    const value = state[key];
    if (value === undefined) throw new Error('useTestDatabase() values are available inside tests only');
    return value;
  };
  return {
    get db() {
      return get('db');
    },
    get url() {
      return get('url');
    },
    get name() {
      return get('name');
    },
  };
}

/** Test-only escape hatch: the admin URL for creating extra databases in a test. */
export const testAdminUrl = (): string => inject('chronosDbAdminUrl');
