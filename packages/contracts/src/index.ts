// @chronos/contracts — the API surface shared by API, workers and client (SYSTEM_ARCHITECTURE §3.2).
// Client-safe: no Node built-ins (enforced by dependency-cruiser).
export {
  ApiClientError,
  createApiClient,
  type ApiClient,
  type ApiClientOptions,
  type CallInput,
  type CallOptions,
  type CallResult,
  type ClientErrorCode,
} from './client';
export {
  APP_SCHEME,
  AUTH_BASE_PATH,
  AUTH_COOKIE_PREFIX,
  EMAIL_MAX_LENGTH,
  EmailAddress,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  Password,
  authErrorCode,
} from './auth';
export { ERROR_CODES, ErrorCodeSchema, ErrorResponse, errorStatus, type ErrorCode } from './errors';
export { EventType, defineEvent, eventEnvelope, events, type EventDefinition } from './events';
export { IDEMPOTENCY_HEADER, IdempotencyKey } from './idempotency';
export { buildOpenApiDocument } from './openapi/build';
export { PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX, PageQuery, page } from './pagination';
export { AmountString, BigIntString, InstantString, Uuid } from './primitives';
export * from './routes';

/** Version of the API contract (OpenAPI info.version). Bump with breaking changes. */
export const API_VERSION = '0.1.0';
