import { existsSync } from 'node:fs';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { routes } from '@chronos/contracts';
import type { FastifyServerOptions } from 'fastify';
import { buildApp, type BuildAppOptions } from '../src/app';
import { loggerOptions } from '../src/logging';

const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (!process.env.REDIS_URL && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export const up = { ping: () => Promise.resolve() };
export const down = { ping: () => Promise.reject(new Error('down')) };

export const testConfig: BuildAppOptions['config'] = {
  env: 'test',
  corsOrigins: ['http://localhost:8081'],
  logLevel: 'silent',
  rateLimit: { max: 1000, windowMs: 60_000 },
  trustProxy: false,
};

/** Contracts that need no session: what an app built WITHOUT authentication can serve. */
export const publicRoutes = routes.filter((r) => r.auth === 'none');

/** An app with fake infrastructure and no authentication (platform tests). Auth tests use test/auth-helpers.ts. */
export const makeApp = (overrides: Partial<BuildAppOptions> = {}) =>
  buildApp({
    config: testConfig,
    deps: { database: up, redis: up },
    logger: false,
    registry: publicRoutes,
    ...overrides,
  });

/** A logger that writes JSON lines into memory, with the production redaction/serializer settings. */
export function captureLogs(): { logger: FastifyServerOptions['logger']; lines: string[] } {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(...chunk.toString().split('\n').filter(Boolean));
      callback();
    },
  });
  return {
    logger: { ...loggerOptions('info', false), stream },
    lines,
  };
}
