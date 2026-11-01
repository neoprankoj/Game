import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Loads the repository's root .env for local CLIs. Hosted environments set variables directly. */
export function loadRootEnv(): void {
  const file = fileURLToPath(new URL('../../../../.env', import.meta.url));
  if (existsSync(file)) process.loadEnvFile(file);
}
