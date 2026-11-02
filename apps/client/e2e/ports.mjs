import { resolve } from 'node:path';

// Fixed ports for the end-to-end run (kept away from the dev defaults 3000/8081).
export const E2E_API_PORT = 3919;
export const E2E_WEB_PORT = 4319;
export const E2E_API_URL = `http://127.0.0.1:${E2E_API_PORT}`;
export const E2E_WEB_URL = `http://127.0.0.1:${E2E_WEB_PORT}`;

// Dev mailbox of the e2e API (account emails as JSON lines); recreated by every run (e2e/build-web.mjs).
// Resolved from the working directory (apps/client for both the build script and Playwright): Playwright loads this
// file in a way that does not allow import.meta.
export const E2E_MAILBOX = resolve('test-results', 'e2e-mailbox.jsonl');
