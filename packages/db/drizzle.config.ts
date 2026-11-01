// drizzle-kit configuration (ADR-0006). Migrations are generated as SQL, committed and reviewed.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  // Only schemas this project owns; Better Auth's `auth` schema is managed in Part 2.8.
  schemaFilter: ['game', 'platform'],
  migrations: { schema: 'drizzle', table: '__migrations' },
  strict: true,
  verbose: true,
});
