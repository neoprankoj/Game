import { IDEMPOTENCY_HEADER, IdempotencyKey, type RouteContract } from '@chronos/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ApiError } from './errors';

type Out<S> = S extends z.ZodType ? z.output<S> : undefined;
type Req<R extends RouteContract> = NonNullable<R['request']>;

/** What a handler receives: decoded, validated input (bigint/epoch-ms, not wire strings). */
export interface HandlerInput<R extends RouteContract> {
  params: Out<Req<R>['params']>;
  query: Out<Req<R>['query']>;
  body: Out<Req<R>['body']>;
  /** Present on mutating routes (validated format). Storage/replay arrives in Part 3.6. */
  idempotencyKey: R['idempotent'] extends true ? string : undefined;
  request: FastifyRequest;
}

/** A handler returns one of the contract's success responses, as domain values; the adapter encodes them. */
export type HandlerResult<R extends RouteContract> = {
  [S in keyof R['responses'] & number]: { status: S; body: z.output<R['responses'][S]['schema']> };
}[keyof R['responses'] & number];

export interface RouteBinding<R extends RouteContract = RouteContract> {
  contract: R;
  handler: (input: HandlerInput<R>) => Promise<HandlerResult<R>>;
}

export const bind = <const R extends RouteContract>(
  contract: R,
  handler: (input: HandlerInput<R>) => Promise<HandlerResult<R>>,
): RouteBinding => ({ contract, handler });

const issuesOf = (location: string, error: z.ZodError) =>
  error.issues.map((i) => ({ location, path: i.path.join('.'), message: i.message }));

function decode(
  location: 'params' | 'query' | 'body',
  schema: z.ZodType | undefined,
  value: unknown,
): unknown {
  if (!schema) return undefined;
  const result = z.safeDecode(schema, value);
  if (!result.success) {
    throw new ApiError('VALIDATION_FAILED', `Invalid ${location}.`, {
      issues: issuesOf(location, result.error),
    });
  }
  return result.data;
}

/**
 * Registers one contract route (ADR-0013): Fastify path syntax from the contract, Zod decoding of params/query/body,
 * Idempotency-Key format check, and response encoding through the contract schema, so the wire format can never drift.
 */
export function registerContractRoute(app: FastifyInstance, binding: RouteBinding): void {
  const { contract, handler } = binding;
  if (contract.auth !== 'none') {
    // Refuse rather than accidentally serve a protected route publicly. Sessions arrive in Part 2.8.
    throw new Error(
      `route ${contract.id} needs auth "${contract.auth}", which is not available before Part 2.8`,
    );
  }
  app.route({
    method: contract.method,
    url: contract.path.replace(/\{([a-zA-Z]+)\}/g, ':$1'),
    handler: async (request, reply) => {
      let idempotencyKey: string | undefined;
      if (contract.idempotent) {
        const parsed = IdempotencyKey.safeParse(request.headers[IDEMPOTENCY_HEADER.toLowerCase()]);
        if (!parsed.success) {
          throw new ApiError(
            'IDEMPOTENCY_KEY_REQUIRED',
            `Header ${IDEMPOTENCY_HEADER} is required (16–128 chars).`,
          );
        }
        idempotencyKey = parsed.data;
      }
      const input = {
        params: decode('params', contract.request?.params, request.params),
        query: decode('query', contract.request?.query, request.query),
        body: decode('body', contract.request?.body, request.body),
        idempotencyKey,
        request,
      };
      const result = await handler(input as never);
      const response = contract.responses[result.status];
      if (!response)
        throw new Error(`route ${contract.id} returned undeclared status ${String(result.status)}`);
      const wire = z.safeEncode(response.schema, result.body);
      if (!wire.success) {
        // A handler bug: never send something the contract does not allow.
        throw new Error(
          `route ${contract.id} produced a body that violates its contract: ${wire.error.message}`,
        );
      }
      return reply.code(result.status).send(wire.data);
    },
  });
}

/**
 * Startup check: the API serves exactly the contract registry, each route bound once, nothing ad hoc.
 * This is what makes "the API imports its types from contracts" structural (Part 2.4 open criterion).
 */
export function assertBindingsMatchRegistry(
  bindings: readonly RouteBinding[],
  registry: readonly RouteContract[],
): void {
  const bound = new Map<RouteContract, number>();
  for (const b of bindings) {
    if (!registry.includes(b.contract))
      throw new Error(`route ${b.contract.id} is not in the contracts registry`);
    bound.set(b.contract, (bound.get(b.contract) ?? 0) + 1);
  }
  for (const c of registry) {
    const n = bound.get(c) ?? 0;
    if (n !== 1) throw new Error(`contract ${c.id} must be bound exactly once (found ${String(n)})`);
  }
}
