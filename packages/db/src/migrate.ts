import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../migrations', import.meta.url));

/** Arbitrary constant: serialises concurrent migration runs (e.g. two deploys starting at once). */
const MIGRATION_ADVISORY_LOCK = 7_202_611_001;

/**
 * Applies all pending migrations (forward-only, DATABASE_DESIGN §6). Safe to call concurrently:
 * a session advisory lock makes later callers wait and then find nothing to do.
 */
export async function runMigrations(url: string, migrationsFolder = MIGRATIONS_FOLDER): Promise<void> {
  const client = new pg.Client({
    connectionString: url,
    application_name: 'chronos-migrate',
    options: '-c timezone=UTC',
  });
  await client.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_ADVISORY_LOCK]);
    try {
      await migrate(drizzle(client), {
        migrationsFolder,
        migrationsSchema: 'drizzle',
        migrationsTable: '__migrations',
      });
    } finally {
      await client.query('select pg_advisory_unlock($1)', [MIGRATION_ADVISORY_LOCK]);
    }
  } finally {
    await client.end();
  }
}
