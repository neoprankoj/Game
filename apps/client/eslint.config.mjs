import { defineChronosConfig } from '@chronos/config/eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...defineChronosConfig({
    tsconfigRootDir: import.meta.dirname,
    kind: 'app',
    ignores: ['dist-web/**', 'dist-native/**', 'dist-e2e/**', '.expo/**', 'e2e/*.mjs'],
  }),
  reactHooks.configs.flat.recommended,
  {
    // Every HTTP call goes through the typed client built from @chronos/contracts (ADR-0013, Part 2.4):
    // raw fetch is allowed only in the module that creates that client.
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['src/api.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Use the typed API client (src/api.ts).' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'globalThis', property: 'fetch', message: 'Use the typed API client (src/api.ts).' },
      ],
    },
  },
];
