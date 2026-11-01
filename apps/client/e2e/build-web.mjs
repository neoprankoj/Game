// Builds the web app for the e2e run, pointing it at the e2e API (EXPO_PUBLIC_* is inlined at build time).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { E2E_API_URL } from './ports.mjs';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const result = spawnSync(
  process.execPath,
  ['node_modules/expo/bin/cli', 'export', '--platform', 'web', '--output-dir', 'dist-e2e'],
  { cwd, stdio: 'inherit', env: { ...process.env, EXPO_PUBLIC_API_URL: E2E_API_URL } },
);
process.exit(result.status ?? 1);
