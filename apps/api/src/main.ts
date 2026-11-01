// Process entry point (composition root): config → dependencies → app → listen → graceful shutdown.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { loadConfig } from './config';
import { createDependencies } from './deps';
import type { Lifecycle } from './modules/system';

const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (process.env.NODE_ENV !== 'production' && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const config = loadConfig();
let warn: (source: string, error: Error) => void = () => undefined; // bound to the app logger below
const deps = createDependencies(config, {
  onWarning: (source, error) => {
    warn(source, error);
  },
});
const lifecycle: Lifecycle = { shuttingDown: false };
const app = await buildApp({ config, deps, lifecycle });
warn = (source, error) => {
  app.log.warn({ source, err: error }, 'infrastructure connection problem');
};

async function shutdown(signal: string): Promise<void> {
  if (lifecycle.shuttingDown) return;
  lifecycle.shuttingDown = true; // /ready → 503 at once
  app.log.info({ signal }, 'shutdown started');
  const force = setTimeout(() => {
    app.log.fatal('shutdown timed out; exiting');
    process.exit(1);
  }, config.shutdownTimeoutMs);
  force.unref();
  try {
    await app.close(); // stop accepting, finish in-flight requests
    await deps.close();
    app.log.info('shutdown complete');
    process.exit(0);
  } catch (error) {
    app.log.fatal({ err: error }, 'shutdown failed');
    process.exit(1);
  }
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ host: config.host, port: config.port });
