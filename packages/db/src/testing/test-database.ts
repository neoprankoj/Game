import pg from 'pg';
import { runMigrations } from '../migrate';

const quoteIdent = (name: string): string => {
  if (!/^[a-z0-9_]{1,63}$/.test(name)) throw new Error(`unsafe database name: ${name}`);
  return `"${name}"`;
};

/** Same server and credentials as `adminUrl`, different database. */
export const urlForDatabase = (adminUrl: string, database: string): string => {
  const url = new URL(adminUrl);
  url.pathname = `/${database}`;
  return url.toString();
};

async function withAdmin<T>(adminUrl: string, fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: adminUrl, application_name: 'chronos-test-admin' });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function createEmptyDatabase(adminUrl: string, name: string): Promise<string> {
  await withAdmin(adminUrl, async (c) => {
    await c.query(`drop database if exists ${quoteIdent(name)} with (force)`);
    await c.query(`create database ${quoteIdent(name)}`);
  });
  return urlForDatabase(adminUrl, name);
}

export async function dropDatabase(adminUrl: string, name: string): Promise<void> {
  await withAdmin(adminUrl, (c) => c.query(`drop database if exists ${quoteIdent(name)} with (force)`));
}

/** Drops leftovers from crashed runs of this package (prefix-scoped, so parallel packages are unaffected). */
export async function dropDatabasesWithPrefix(adminUrl: string, prefix: string): Promise<number> {
  return withAdmin(adminUrl, async (c) => {
    const { rows } = await c.query<{ datname: string }>(
      'select datname from pg_database where datname like $1',
      [`${prefix.replace(/_/g, '\\_')}%`],
    );
    for (const { datname } of rows)
      await c.query(`drop database if exists ${quoteIdent(datname)} with (force)`);
    return rows.length;
  });
}

/** Creates `name` and applies all migrations: the template every test file clones. */
export async function createTemplateDatabase(adminUrl: string, name: string): Promise<void> {
  const url = await createEmptyDatabase(adminUrl, name);
  await runMigrations(url);
}

/** Clones the migrated template: fast (file copy), fully isolated per test file. */
export async function cloneDatabase(adminUrl: string, template: string, name: string): Promise<string> {
  await withAdmin(adminUrl, (c) =>
    c.query(`create database ${quoteIdent(name)} template ${quoteIdent(template)}`),
  );
  return urlForDatabase(adminUrl, name);
}
