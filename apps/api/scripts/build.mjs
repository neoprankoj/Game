// Production build (ADR-0012): one ESM bundle. Workspace packages (TypeScript source) and their
// dependencies are inlined; this app's own npm dependencies stay external and are installed at deploy time.
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const external = Object.entries(pkg.dependencies)
  .filter(([, version]) => !String(version).startsWith('workspace:'))
  .map(([name]) => name);

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.mjs',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true,
  // pg-native is an optional native addon pg probes for; we use the pure-JS driver.
  external: [...external, 'pg-native'],
  // Bundled CommonJS dependencies (pg) call require(); give them one inside the ESM bundle.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: 'info',
});
