import base from '@chronos/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

// Unit tests for platform-independent client logic only (config). Screens are covered by Playwright (e2e/).
export default mergeConfig(base, defineConfig({ test: { include: ['src/**/*.test.ts'] } }));
