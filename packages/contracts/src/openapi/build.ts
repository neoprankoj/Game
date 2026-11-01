import { z } from 'zod';
import { ERROR_CODES, ErrorResponse, type ErrorCode } from '../errors';
import { IDEMPOTENCY_HEADER, IdempotencyKey } from '../idempotency';
import type { RouteContract } from '../routes';

/** Errors any route can return (enforced by the API platform: validation, auth, rate limits, crashes). */
const GENERIC_ERRORS: readonly ErrorCode[] = ['VALIDATION_FAILED', 'RATE_LIMITED', 'INTERNAL_ERROR'];
const AUTH_ERRORS: readonly ErrorCode[] = ['UNAUTHENTICATED'];
const ADMIN_ERRORS: readonly ErrorCode[] = ['UNAUTHENTICATED', 'FORBIDDEN'];
const IDEMPOTENCY_ERRORS: readonly ErrorCode[] = ['IDEMPOTENCY_KEY_REQUIRED', 'IDEMPOTENCY_KEY_REUSED'];

type JsonSchema = Record<string, unknown>;

/**
 * Session authentication (Better Auth, ADR-0007). Web uses a secure cookie, native sends the session token.
 * The concrete cookie/header names are fixed in Part 2.8; the scheme appears only once a non-public route exists.
 */
const SESSION_SECURITY_SCHEME = {
  type: 'apiKey',
  in: 'cookie',
  name: 'session',
  description: 'Better Auth session (cookie on web, token header on native). Exact names: Part 2.8.',
};
const ref = (id: string): JsonSchema => ({ $ref: `#/components/schemas/${id}` });
const schemaId = (schema: z.ZodType, where: string): string => {
  const id = z.globalRegistry.get(schema)?.id;
  if (!id)
    throw new Error(`${where}: request/response schemas need .meta({ id }) to become OpenAPI components`);
  return id;
};
/** Wire format = what the API parses/emits as JSON = the codec *input* side (strings for bigint/instants). */
const JSON_SCHEMA_OPTIONS = { io: 'input', target: 'draft-2020-12', unrepresentable: 'throw' } as const;
const COMPONENT_REF = /#\/components\/schemas\/([A-Za-z0-9_]+)/g;

const toJson = (schema: z.ZodType): JsonSchema => {
  const json = z.toJSONSchema(schema, JSON_SCHEMA_OPTIONS) as JsonSchema;
  delete json.$schema;
  return json;
};

/**
 * Converts every schema registered with `.meta({ id })` in ONE pass, so nested named schemas become
 * `#/components/schemas/<id>` references. Converting schemas one by one produces `#/$defs/...` refs that
 * do not resolve inside an OpenAPI document (bug found and fixed in Part 2.4).
 * Only components reachable from `rootIds` are kept, so unrelated registered schemas (e.g. tests) never leak in.
 */
function componentSchemas(rootIds: Iterable<string>): Record<string, JsonSchema> {
  const all = (
    z.toJSONSchema(z.globalRegistry, {
      ...JSON_SCHEMA_OPTIONS,
      uri: (id) => `#/components/schemas/${id}`,
    }) as {
      schemas: Record<string, JsonSchema>;
    }
  ).schemas;
  const needed = new Map<string, JsonSchema>();
  const queue = [...rootIds];
  for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
    if (needed.has(id)) continue;
    const schema = all[id];
    if (!schema) throw new Error(`component ${id} is not registered`);
    const clean = Object.fromEntries(
      Object.entries(schema).filter(([key]) => key !== '$schema' && key !== '$id'),
    );
    needed.set(id, clean);
    for (const m of JSON.stringify(clean).matchAll(COMPONENT_REF)) if (m[1]) queue.push(m[1]);
  }
  return Object.fromEntries([...needed].sort(([a], [b]) => a.localeCompare(b)));
}

function parametersOf(route: RouteContract): JsonSchema[] {
  const out: JsonSchema[] = [];
  for (const [location, shapeOwner] of [
    ['path', route.request?.params],
    ['query', route.request?.query],
  ] as const) {
    if (!shapeOwner) continue;
    const json = toJson(shapeOwner) as { properties?: Record<string, JsonSchema>; required?: string[] };
    for (const [name, schema] of Object.entries(json.properties ?? {})) {
      out.push({
        name,
        in: location,
        required: location === 'path' || (json.required ?? []).includes(name),
        schema,
      });
    }
  }
  if (route.idempotent)
    out.push({ name: IDEMPOTENCY_HEADER, in: 'header', required: true, schema: toJson(IdempotencyKey) });
  return out;
}

function errorResponses(route: RouteContract): Record<string, JsonSchema> {
  const codes = new Set<ErrorCode>([
    ...GENERIC_ERRORS,
    ...(route.auth === 'session' ? AUTH_ERRORS : route.auth === 'admin' ? ADMIN_ERRORS : []),
    ...(route.idempotent ? IDEMPOTENCY_ERRORS : []),
    ...route.errors,
  ]);
  const byStatus = new Map<number, ErrorCode[]>();
  for (const code of codes)
    byStatus.set(ERROR_CODES[code].status, [...(byStatus.get(ERROR_CODES[code].status) ?? []), code]);
  const out: Record<string, JsonSchema> = {};
  for (const [status, list] of [...byStatus].sort(([a], [b]) => a - b)) {
    out[String(status)] = {
      description: `Error codes: ${list.sort().join(', ')}`,
      content: { 'application/json': { schema: ref(schemaId(ErrorResponse, 'ErrorResponse')) } },
    };
  }
  return out;
}

/** Builds the OpenAPI 3.1 document from the route contracts. Pure and deterministic (sorted output). */
export function buildOpenApiDocument(routes: readonly RouteContract[], version: string): JsonSchema {
  const componentIds = new Set<string>([schemaId(ErrorResponse, 'ErrorResponse')]);
  const paths: Record<string, Record<string, JsonSchema>> = {};
  const needsSession = routes.some((r) => r.auth !== 'none');
  const ids = new Set<string>();
  for (const route of routes) {
    if (ids.has(route.id)) throw new Error(`duplicate route id ${route.id}`);
    ids.add(route.id);
    const where = `route ${route.id}`;
    const responses: Record<string, JsonSchema> = {};
    for (const [status, response] of Object.entries(route.responses)) {
      const id = schemaId(response.schema, where);
      componentIds.add(id);
      responses[status] = {
        description: response.description,
        content: { 'application/json': { schema: ref(id) } },
      };
    }
    Object.assign(responses, errorResponses(route));
    const operation: JsonSchema = {
      operationId: route.id,
      summary: route.summary,
      tags: [...route.tags],
      parameters: parametersOf(route),
      responses,
      'x-auth': route.auth,
      // Explicit for every operation: public routes declare `[]`; others need a session (OpenAPI security rules).
      security: route.auth === 'none' ? [] : [{ session: [] }],
    };
    if (route.request?.body) {
      const id = schemaId(route.request.body, where);
      componentIds.add(id);
      operation.requestBody = { required: true, content: { 'application/json': { schema: ref(id) } } };
    }
    paths[route.path] ??= {};
    const item = paths[route.path];
    if (item) item[route.method.toLowerCase()] = operation;
  }
  const schemas = componentSchemas(componentIds);
  return {
    openapi: '3.1.0',
    info: {
      title: 'Chronos Cradle API',
      version,
      description:
        'GENERATED from packages/contracts (route contracts + Zod schemas). Do not edit by hand: run `pnpm api:spec`.',
    },
    // Relative: the spec describes every environment (local, staging, production); hosts are set per deployment.
    servers: [{ url: '/', description: 'The API host of the environment in use' }],
    paths: Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b))),
    components: {
      schemas,
      ...(needsSession ? { securitySchemes: { session: SESSION_SECURITY_SCHEME } } : {}),
    },
  };
}
