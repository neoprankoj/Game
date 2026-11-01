import { z } from 'zod';

const postgresUrl = z
  .string({ error: 'is required' })
  .regex(/^postgres(ql)?:\/\/.+/, { error: 'must be a postgres:// connection string' });

/** Reads and validates a PostgreSQL connection string from the environment (CLAUDE.md §8: Zod at boundaries). */
export function readDatabaseUrl(
  key: 'DATABASE_URL' | 'TEST_DATABASE_URL' = 'DATABASE_URL',
  env: NodeJS.ProcessEnv = process.env,
): string {
  const parsed = postgresUrl.safeParse(env[key]);
  if (!parsed.success) {
    throw new Error(
      `${key} ${parsed.error.issues[0]?.message ?? 'is invalid'}. Copy .env.example to .env (see README).`,
    );
  }
  return parsed.data;
}
