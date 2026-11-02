// drizzle-kit configuration (ADR-0006). Migrations are generated as SQL, committed and reviewed.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  // Schemas this project migrates. `auth` tables are defined from Better Auth's generator output (Part 2.8).
  schemaFilter: ['auth', 'game', 'platform'],
  migrations: { schema: 'drizzle', table: '__migrations' },
  strict: true,
  verbose: true,
});
