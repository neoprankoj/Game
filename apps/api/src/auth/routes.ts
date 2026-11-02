import { AUTH_BASE_PATH } from '@chronos/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { CLIENT_IP_HEADER, type AuthService } from './service';

/** Fastify headers → Fetch headers, with the client IP set by US (any incoming value is dropped). */
export function toFetchHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined || name === CLIENT_IP_HEADER) continue;
    if (Array.isArray(value)) for (const v of value) headers.append(name, v);
    else headers.set(name, value);
  }
  headers.set(CLIENT_IP_HEADER, request.ip);
  return headers;
}

/**
 * Mounts Better Auth's catch-all route (ADR-0007; Fastify integration from the library docs, adapted):
 * - the JSON body is forwarded as the exact bytes received (no parse/re-serialise round trip);
 * - every `Set-Cookie` header is copied separately (joining them with commas would corrupt cookies).
 * These endpoints speak the library's format, not our ErrorResponse (ADR-0013 exception); the client maps codes.
 */
export async function registerAuthRoutes(app: FastifyInstance, auth: AuthService): Promise<void> {
  await app.register((scope, _opts, done) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser(
      ['application/json', 'application/x-www-form-urlencoded'],
      { parseAs: 'string' },
      (_req, body, next) => {
        next(null, body);
      },
    );
    scope.route({
      method: ['GET', 'POST'],
      url: `${AUTH_BASE_PATH}/*`,
      handler: async (request, reply) => {
        const url = new URL(request.url, 'http://placeholder.invalid'); // only the path and query are used
        const body = typeof request.body === 'string' && request.body.length > 0 ? request.body : undefined;
        const response = await auth.handle(
          new Request(new URL(url.pathname + url.search, auth.origin), {
            method: request.method,
            headers: toFetchHeaders(request),
            ...(body !== undefined ? { body } : {}),
          }),
        );
        void reply.code(response.status);
        response.headers.forEach((value, name) => {
          if (name !== 'set-cookie' && name !== 'content-length') void reply.header(name, value);
        });
        const cookies = response.headers.getSetCookie();
        if (cookies.length > 0) void reply.header('set-cookie', cookies);
        return reply.send(response.body ? await response.text() : null);
      },
    });
    done();
  });
}
