// Worker process entry point (composition root): config → Redis → checks → workers → graceful shutdown.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config';
import { jobs } from './jobs';
import { createLogger } from './logging';
import { assertNoEviction, createRedisConnection } from './redis';
import { startRuntime } from './runtime';

const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (process.env.NODE_ENV !== 'production' && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const config = loadConfig();
const log = createLogger(config.LOG_LEVEL, config.NODE_ENV === 'development');
const connection = createRedisConnection(config.REDIS_URL);
connection.on('error', (error) => {
  log.warn({ err: error }, 'redis connection problem');
});

try {
  await assertNoEviction(connection, log);
} catch (error) {
  log.fatal({ err: error }, 'refusing to start');
  process.exit(1);
}

const runtime = await startRuntime({
  connection,
  prefix: config.QUEUE_PREFIX,
  jobs,
  log,
  concurrency: config.WORKER_CONCURRENCY,
  reconcilerIntervalMs: config.RECONCILER_INTERVAL_MS,
});

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  log.info({ signal }, 'shutdown started');
  const force = setTimeout(() => {
    log.fatal('shutdown timed out; exiting (unfinished jobs will be retried or reconciled)');
    process.exit(1);
  }, config.WORKER_SHUTDOWN_TIMEOUT_MS);
  force.unref();
  try {
    await runtime.close();
    await connection.quit();
    log.info('shutdown complete');
    process.exit(0);
  } catch (error) {
    log.fatal({ err: error }, 'shutdown failed');
    process.exit(1);
  }
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
