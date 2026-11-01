import { defineChronosConfig } from './eslint/index.js';

export default defineChronosConfig({
  tsconfigRootDir: import.meta.dirname,
  kind: 'package',
  ignores: ['test/fixtures/**'],
});
