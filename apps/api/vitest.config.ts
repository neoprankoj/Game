import { createRequire } from 'node:module';
import base from '@chronos/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

export default mergeConfig(
  base,
  defineConfig({
    test: {
      // Readiness tests use a real, isolated database (TESTING_STRATEGY §2) and the local Redis.
      globalSetup: [require.resolve('@chronos/db/testing/global-setup')],
      testTimeout: 20_000,
      hookTimeout: 60_000,
    },
  }),
);
