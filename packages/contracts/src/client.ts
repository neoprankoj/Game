import { z } from 'zod';
import { ErrorResponse, type ErrorCode } from './errors';
import { IDEMPOTENCY_HEADER } from './idempotency';
import type { RouteContract } from './routes';

/**
 * Typed API client derived from the route contracts (ADR-0013): the client never declares its own request or
 * response types. Inputs are DOMAIN values (bigint, epoch ms); the client encodes them to the wire with the same
 * codecs the API decodes with, and decodes responses the same way.
 */

type In<S> = S extends z.ZodType ? z.output<S> : never;
type Req<R extends RouteContract> = NonNullable<R['request']>;
type Field<R extends RouteContract, K extends 'params' | 'query' | 'body'> = Req<R>[K] extends z.ZodType
  ? { [P in K]: In<Req<R>[K]> }
  : { [P in K]?: never };

/** What a call needs: exactly the params/query/body the contract declares, as domain values. */
export type CallInput<R extends RouteContract> = Field<R, 'params'> & Field<R, 'query'> & Field<R, 'body'>;

/** One of the contract's declared responses (including declared non-2xx ones such as /ready's 503). */
export type CallResult<R extends RouteContract> = {
  [S in keyof R['responses'] & number]: { status: S; body: z.output<R['responses'][S]['schema']> };
}[keyof R['responses'] & number];

export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE';

/** Every failure a call can produce, in one shape (UI maps `code` to a message, 12.2). */
export class ApiClientError extends Error {
  override readonly name = 'ApiClientError';
  constructor(
    readonly code: ClientErrorCode,
    message: string,
    readonly status: number | undefined,
    readonly details?: Record<string, unknown>,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

export interface ApiClientOptions {
  /** e.g. https://api.example.com (no trailing slash needed). */
  baseUrl: string;
  /** Generates a fresh idempotency key per *intent*; injected because React Native has no crypto.randomUUID. */
  newIdempotencyKey: () => string;
  fetch?: typeof fetch;
  /** `include` on web so the session cookie travels (Part 2.8). */
  credentials?: 'include' | 'omit' | 'same-origin';
  timeoutMs?: number;
}

export interface CallOptions {
  /** Reuse the key when RETRYING the same intent (Part 3.6 replays the stored response). */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export interface ApiClient {
  call<R extends RouteContract>(route: R, input: CallInput<R>, options?: CallOptions): Promise<CallResult<R>>;
}

function buildUrl(baseUrl: string, route: RouteContract, input: Record<string, unknown>): string {
  let path = route.path;
  if (route.request?.params) {
    const params = z.encode<z.ZodObject>(route.request.params, input.params as Record<string, unknown>);
    path = path.replace(/\{([a-zA-Z]+)\}/g, (_, name: string) => encodeURIComponent(String(params[name])));
  }
  // Relative join keeps a base path such as https://host/api (an absolute '/x' would drop it).
  const url = new URL(path.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (route.request?.query) {
    const query = z.encode<z.ZodObject>(route.request.query, (input.query ?? {}) as Record<string, unknown>);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null)
        url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }
  return url.toString();
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;

  return {
    async call<R extends RouteContract>(route: R, input: CallInput<R>, callOptions: CallOptions = {}) {
      const raw = input as Record<string, unknown>;
      const headers: Record<string, string> = { accept: 'application/json' };
      let body: string | undefined;
      if (route.request?.body) {
        headers['content-type'] = 'application/json';
        body = JSON.stringify(z.encode(route.request.body, raw.body));
      }
      if (route.idempotent)
        headers[IDEMPOTENCY_HEADER] = callOptions.idempotencyKey ?? options.newIdempotencyKey();

      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, timeoutMs);
      callOptions.signal?.addEventListener('abort', () => {
        controller.abort();
      });
      let response: Response;
      try {
        response = await doFetch(buildUrl(options.baseUrl, route, raw), {
          method: route.method,
          headers,
          ...(body !== undefined ? { body } : {}),
          ...(options.credentials ? { credentials: options.credentials } : {}),
          signal: controller.signal,
        });
      } catch (error) {
        const timedOut = controller.signal.aborted && !callOptions.signal?.aborted;
        throw new ApiClientError(
          timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
          timedOut ? `No response within ${String(timeoutMs)} ms` : `Network error: ${String(error)}`,
          undefined,
        );
      } finally {
        clearTimeout(timer);
      }

      const requestId = response.headers.get('x-request-id') ?? undefined;
      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new ApiClientError(
          'INVALID_RESPONSE',
          'Response is not JSON',
          response.status,
          undefined,
          requestId,
        );
      }

      const declared = route.responses[response.status];
      if (declared) {
        const decoded = z.safeDecode(declared.schema, json);
        if (!decoded.success) {
          throw new ApiClientError(
            'INVALID_RESPONSE',
            `Response violates the contract of ${route.id}`,
            response.status,
            { issues: decoded.error.issues },
            requestId,
          );
        }
        return { status: response.status, body: decoded.data } as CallResult<R>;
      }
      const error = ErrorResponse.safeParse(json);
      if (!error.success) {
        throw new ApiClientError(
          'INVALID_RESPONSE',
          `Unexpected ${String(response.status)} response`,
          response.status,
          undefined,
          requestId,
        );
      }
      const { code, message, details, requestId: errorRequestId } = error.data.error;
      throw new ApiClientError(code, message, response.status, details, errorRequestId);
    },
  };
}
