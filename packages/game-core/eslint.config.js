import { defineChronosConfig } from '@chronos/config/eslint';

export default defineChronosConfig({ tsconfigRootDir: import.meta.dirname, kind: 'pure' });
