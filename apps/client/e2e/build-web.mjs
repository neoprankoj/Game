// Builds the web app for the e2e run, pointing it at the e2e API (EXPO_PUBLIC_* is inlined at build time).
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { E2E_API_URL, E2E_MAILBOX } from './ports.mjs';

rmSync(E2E_MAILBOX, { force: true }); // fresh mailbox per run

const cwd = fileURLToPath(new URL('..', import.meta.url));
const result = spawnSync(
  process.execPath,
  ['node_modules/expo/bin/cli', 'export', '--platform', 'web', '--output-dir', 'dist-e2e'],
  { cwd, stdio: 'inherit', env: { ...process.env, EXPO_PUBLIC_API_URL: E2E_API_URL } },
);
process.exit(result.status ?? 1);
