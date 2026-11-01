// `pnpm --filter @chronos/db migrate` (or `pnpm db:migrate` at the root): apply pending migrations.
import { readDatabaseUrl } from '../env';
import { runMigrations } from '../migrate';
import { loadRootEnv } from './load-env';

loadRootEnv();
const url = readDatabaseUrl('DATABASE_URL');
await runMigrations(url);
console.log(`✔ migrations applied (${new URL(url).pathname.slice(1)})`);
