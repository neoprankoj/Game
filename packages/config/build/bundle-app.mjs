// Production bundle for a Node app (ADR-0012, Part 2.5; shared by api and workers since 2.6).
// Workspace packages (TypeScript source) and their dependencies are inlined; the app's own npm dependencies
// stay external and are installed at deploy time.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

/** @param {string} appDir absolute path of the app (contains package.json and src/main.ts) */
export async function bundleApp(appDir) {
  const pkg = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8'));
  const external = Object.entries(pkg.dependencies ?? {})
    .filter(([, version]) => !String(version).startsWith('workspace:'))
    .map(([name]) => name);
  await build({
    absWorkingDir: appDir,
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
}
