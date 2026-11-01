import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { routes as contractRegistry, type RouteContract } from '@chronos/contracts';
import Fastify, { LogController, type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { ApiConfig } from './config';
import type { ApiDependencies } from './deps';
import { assertBindingsMatchRegistry, registerContractRoute, type RouteBinding } from './http/contract-route';
import { ApiError, handleError, handleNotFound } from './http/errors';
import { loggerOptions } from './logging';
import { systemModule, type Lifecycle } from './modules/system';

export interface BuildAppOptions {
  config: Pick<ApiConfig, 'corsOrigins' | 'logLevel' | 'rateLimit' | 'trustProxy' | 'env'>;
  deps: Pick<ApiDependencies, 'database' | 'redis'>;
  lifecycle?: Lifecycle;
  /** Logger override (tests capture logs; production uses loggerOptions). */
  logger?: FastifyServerOptions['logger'];
  /** Test seams: extra modules and a different registry. Production uses the defaults. */
  modules?: readonly RouteBinding[];
  registry?: readonly RouteContract[];
}

const REQUEST_ID = /^[A-Za-z0-9_.:-]{8,128}$/;
export const BODY_LIMIT_BYTES = 100 * 1024;

/**
 * Builds the API (Part 2.5). One module per domain contributes route bindings; the set of bindings must equal the
 * contracts registry (ADR-0013). Infrastructure arrives through `deps`, so tests run with real or fake dependencies.
 */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const lifecycle = options.lifecycle ?? { shuttingDown: false };
  const app = Fastify({
    logger: options.logger ?? loggerOptions(options.config.logLevel, options.config.env === 'development'),
    trustProxy: options.config.trustProxy,
    bodyLimit: BODY_LIMIT_BYTES,
    // Request ids: accept a well-formed one from the platform's proxy (traceability), otherwise generate one.
    requestIdHeader: 'x-request-id',
    genReqId: (req) => {
      const incoming = req.headers['x-request-id'];
      return typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    },
    logController: new LogController({ requestIdLogLabel: 'requestId' }),
    return503OnClosing: true,
  });

  app.setErrorHandler(handleError);
  app.setNotFoundHandler(handleNotFound);
  app.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });

  // contentSecurityPolicy is for HTML documents; this server only returns JSON.
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: (origin, callback) => {
      // Non-browser clients (native app, curl) send no Origin; browsers must match the allow-list exactly.
      callback(null, origin === undefined || options.config.corsOrigins.includes(origin));
    },
    credentials: true, // session cookies (Better Auth, Part 2.8)
    exposedHeaders: ['x-request-id', 'retry-after'],
  });
  await app.register(rateLimit, {
    global: true,
    max: options.config.rateLimit.max,
    timeWindow: options.config.rateLimit.windowMs,
    // In-memory store: one API instance in the MVP. Moves to Redis with per-category limits in Part 11.2.
    errorResponseBuilder: (_request, context) =>
      new ApiError('RATE_LIMITED', `Too many requests; retry in ${String(Math.ceil(context.ttl / 1000))} s.`),
  });

  const bindings = [...systemModule(options.deps, lifecycle), ...(options.modules ?? [])];
  assertBindingsMatchRegistry(bindings, options.registry ?? contractRegistry);
  for (const binding of bindings) registerContractRoute(app, binding);
  return app;
}
