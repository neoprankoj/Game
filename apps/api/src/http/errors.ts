import { ERROR_CODES, type ErrorCode, type ErrorResponse } from '@chronos/contracts';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

/** An error with a catalog code. Domain errors from the application layer are mapped to this (S03+). */
export class ApiError extends Error {
  readonly statusCode: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = ERROR_CODES[code].status;
  }
}

export const errorBody = (
  request: FastifyRequest,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ErrorResponse => ({
  error: { code, message, ...(details ? { details } : {}), requestId: request.id },
});

/** Maps framework errors (body parsing, limits) to catalog codes. Everything unknown is INTERNAL_ERROR. */
function classify(error: FastifyError): {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
} {
  if (error instanceof ApiError) {
    return { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) };
  }
  const status = error.statusCode ?? 500;
  if (status === 413) return { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' };
  if (status === 429) return { code: 'RATE_LIMITED', message: 'Too many requests.' };
  if (status === 404) return { code: 'NOT_FOUND', message: 'Not found.' };
  if (status === 415)
    return { code: 'VALIDATION_FAILED', message: 'Unsupported content type; send application/json.' };
  if (status >= 400 && status < 500) return { code: 'VALIDATION_FAILED', message: 'Malformed request.' };
  return { code: 'INTERNAL_ERROR', message: 'Internal error.' };
}

/** The single error handler: every non-2xx response has the contract `ErrorResponse` shape. */
export function handleError(error: FastifyError, request: FastifyRequest, reply: FastifyReply): void {
  const { code, message, details } = classify(error);
  const status = ERROR_CODES[code].status;
  if (status >= 500) request.log.error({ err: error, code }, 'request failed');
  else request.log.info({ code, status }, 'request rejected');
  void reply.code(status).send(errorBody(request, code, message, details));
}

export function handleNotFound(request: FastifyRequest, reply: FastifyReply): void {
  void reply
    .code(404)
    .send(errorBody(request, 'NOT_FOUND', `No route ${request.method} ${request.url.split('?')[0] ?? ''}`));
}
