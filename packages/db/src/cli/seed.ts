// `pnpm db:seed`: development-only seed data (guarded, see assertSeedAllowed).
import { createDatabase } from '../client';
import { readDatabaseUrl } from '../env';
import { assertSeedAllowed, seeders } from '../seed';
import { loadRootEnv } from './load-env';

loadRootEnv();
const url = readDatabaseUrl('DATABASE_URL');
assertSeedAllowed(process.env, url);
if (seeders.length === 0) {
  console.log('No seeders registered yet (gameplay seed data arrives with its Parts).');
} else {
  const database = createDatabase({ url, applicationName: 'chronos-seed' });
  try {
    for (const seeder of seeders) {
      await database.withTransaction((tx) => seeder.run(tx));
      console.log(`✔ seeded ${seeder.name}`);
    }
  } finally {
    await database.close();
  }
}
