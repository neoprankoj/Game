import base from '@chronos/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      // Builds a migrated template database once per run; each test file clones it (TESTING_STRATEGY §2).
      globalSetup: ['./src/testing/global-setup.ts'],
      testTimeout: 20_000,
      hookTimeout: 60_000,
    },
  }),
);
