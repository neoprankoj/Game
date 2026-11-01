import base from '@chronos/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(base, defineConfig({ test: { testTimeout: 30_000, hookTimeout: 30_000 } }));
