import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
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
      // Processed by Vitest (not loaded by Node) so the aliases below replace the React Native modules that the
      // Expo client plugin imports (test/native-client.test.ts). Nothing in src/ imports these modules.
      server: { deps: { inline: ['@better-auth/expo'] } },
      alias: Object.fromEntries(
        ['react-native', 'expo-constants', 'expo-linking', 'expo-network'].map((name) => [
          name,
          fileURLToPath(new URL(`./test/native-stubs/${name}.ts`, import.meta.url)),
        ]),
      ),
      hookTimeout: 60_000,
    },
  }),
);
