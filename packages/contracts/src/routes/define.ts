import type { z } from 'zod';
import type { ErrorCode } from '../errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
const MUTATING: ReadonlySet<HttpMethod> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface ResponseContract {
  description: string;
  /** Must carry `.meta({ id })`: it becomes a named OpenAPI component. */
  schema: z.ZodType;
}

/**
 * One HTTP route, defined once. The API registers handlers from it (2.5), the client builds its typed
 * calls from it (2.7) and the OpenAPI spec is generated from it, so request/response types never get duplicated.
 */
export interface RouteContract {
  /** Stable operationId, `domain.action` style. */
  id: string;
  method: HttpMethod;
  /** OpenAPI-style path, e.g. `/cities/{cityId}/constructions`. */
  path: string;
  summary: string;
  tags: readonly string[];
  /** Who may call it: `session` (any signed-in player), `admin` (admin role), `none` (public). */
  auth: 'none' | 'session' | 'admin';
  /** Mutating routes require `Idempotency-Key` (Part 3.6); declared explicitly for readability. */
  idempotent: boolean;
  request?: {
    params?: z.ZodObject;
    query?: z.ZodObject;
    /** Must carry `.meta({ id })`. */
    body?: z.ZodType;
  };
  /** Success responses by HTTP status. */
  responses: Readonly<Record<number, ResponseContract>>;
  /** Error codes this route may return besides the generic ones (validation, auth, rate limit, internal). */
  errors: readonly ErrorCode[];
}

/** Declares a route and checks its invariants when the module loads (so a broken contract fails every test). */
export function defineRoute<const R extends RouteContract>(route: R): R {
  const where = `route ${route.id} (${route.method} ${route.path})`;
  if (!/^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z]*)+$/.test(route.id))
    throw new Error(`${where}: id must look like "domain.action"`);
  if (!route.path.startsWith('/')) throw new Error(`${where}: path must start with /`);
  if (MUTATING.has(route.method) !== route.idempotent) {
    throw new Error(`${where}: idempotent must be ${String(MUTATING.has(route.method))} for ${route.method}`);
  }
  const pathParams = [...route.path.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]).sort();
  const declared = Object.keys(route.request?.params?.shape ?? {}).sort();
  if (pathParams.join(',') !== declared.join(',')) {
    throw new Error(
      `${where}: path params {${pathParams.join(',')}} ≠ declared params {${declared.join(',')}}`,
    );
  }
  if (Object.keys(route.responses).length === 0) throw new Error(`${where}: at least one response`);
  return route;
}
