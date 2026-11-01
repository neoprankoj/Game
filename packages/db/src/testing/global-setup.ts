// Vitest globalSetup for any package with database tests (TESTING_STRATEGY §2):
// once per run, build a migrated template database; each test file then clones it (useTestDatabase).
import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';
import { readDatabaseUrl } from '../env';
import './context';
import { createTemplateDatabase, dropDatabase, dropDatabasesWithPrefix } from './test-database';

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const rootEnv = fileURLToPath(new URL('../../../../.env', import.meta.url));
  if (!process.env.TEST_DATABASE_URL && existsSync(rootEnv)) process.loadEnvFile(rootEnv);
  const adminUrl = readDatabaseUrl('TEST_DATABASE_URL');

  // Prefix per package so parallel Turborepo test runs never touch each other's databases.
  const pkg = basename(project.config.root).replace(/[^a-z0-9]/g, '_');
  const prefix = `chronos_t_${pkg}_`;
  const template = `chronos_tpl_${pkg}`;
  try {
    await dropDatabasesWithPrefix(adminUrl, prefix);
    await createTemplateDatabase(adminUrl, template);
  } catch (error) {
    throw new Error(
      `Test database setup failed (${String(error)}). Is the local stack running? → pnpm dev:up`,
      { cause: error },
    );
  }
  project.provide('chronosDbAdminUrl', adminUrl);
  project.provide('chronosDbTemplate', template);
  project.provide('chronosDbPrefix', prefix);

  return async () => {
    await dropDatabasesWithPrefix(adminUrl, prefix);
    await dropDatabase(adminUrl, template);
  };
}
