import type { Tx } from '../types';

/** A development-only data seeder. Gameplay Parts register seeders here (e.g. a test region in 7.2). */
export interface Seeder {
  name: string;
  run(tx: Tx): Promise<void>;
}

export const seeders: readonly Seeder[] = [];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Seeding writes fake data, so it is refused unless NODE_ENV=development AND the database is on this machine.
 * This prevents accidentally seeding staging or production (rule 21).
 */
export function assertSeedAllowed(env: NodeJS.ProcessEnv, databaseUrl: string): void {
  if (env.NODE_ENV !== 'development') {
    throw new Error(
      `Refusing to seed: NODE_ENV is "${env.NODE_ENV ?? '(unset)'}", seeding requires "development".`,
    );
  }
  const host = new URL(databaseUrl).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Refusing to seed: database host "${host}" is not local.`);
  }
}
