// Shared Vitest preset (ADR-0002, TESTING_STRATEGY §2). Packages re-export or merge it.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    // A test run that finds no tests is a misconfiguration, not a success.
    passWithNoTests: false,
  },
});
