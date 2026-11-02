import { z } from 'zod';

/**
 * Error code catalog: every error the API can return. Codes are stable identifiers for clients
 * (and translations, 12.2); messages are for humans and may change. Domain codes come from the
 * "Failure handling" fields of DOMAINS.md (test/errors.test.ts keeps both in sync).
 */
export const ERROR_CODES = {
  // --- generic (API platform) ---------------------------------------------------------------
  VALIDATION_FAILED: {
    status: 400,
    description: 'Request did not match the contract (details lists the issues).',
  },
  IDEMPOTENCY_KEY_REQUIRED: {
    status: 400,
    description: 'Mutating request without a valid Idempotency-Key header.',
  },
  UNAUTHENTICATED: { status: 401, description: 'No valid session.' },
  AUTH_INVALID_CREDENTIALS: { status: 401, description: 'Email or password is wrong (never says which).' },
  FORBIDDEN: { status: 403, description: 'Authenticated but not allowed (e.g. admin-only).' },
  NOT_FOUND: { status: 404, description: 'Resource does not exist or is not visible to the caller.' },
  CONFLICT: { status: 409, description: 'Generic state conflict; retry after refreshing.' },
  PAYLOAD_TOO_LARGE: { status: 413, description: 'Request body exceeds the limit.' },
  IDEMPOTENCY_KEY_REUSED: {
    status: 422,
    description: 'Idempotency-Key was already used with a different request.',
  },
  RATE_LIMITED: { status: 429, description: 'Too many requests; see Retry-After.' },
  INTERNAL_ERROR: { status: 500, description: 'Unexpected server error (reported to error tracking).' },
  SERVICE_UNAVAILABLE: { status: 503, description: 'A dependency is down; retry later.' },
  // --- domain (DOMAINS.md) ---------------------------------------------------------------------
  AUTH_EMAIL_NOT_VERIFIED: {
    status: 403,
    description: 'Sign-in refused until the email address is confirmed; a new link was sent (D01).',
  },
  AUTH_TOKEN_INVALID: {
    status: 400,
    description: 'Verification or password-reset link is invalid, used or expired (D01).',
  },
  DISPLAY_NAME_TAKEN: { status: 409, description: 'Display name already in use (D02).' },
  WORLD_FULL: { status: 503, description: 'No free spawn island; the owner must open a region (D03/D16).' },
  ISLAND_OCCUPIED: { status: 409, description: 'Island already hosts a city or outpost (D04).' },
  INSUFFICIENT_RESOURCES: {
    status: 422,
    description: 'Balances do not cover the cost; details lists the shortfall (D06).',
  },
  INSUFFICIENT_POPULATION: {
    status: 422,
    description: 'Not enough free population; details has the shortfall (D07).',
  },
  QUEUE_FULL: { status: 422, description: 'Construction or recruitment queue is full (D08/D10).' },
  PREREQUISITE_MISSING: {
    status: 422,
    description: 'A required building or technology is missing (D08/D09).',
  },
  ALREADY_QUEUED: { status: 409, description: 'This building is already in the queue (D08).' },
  MAX_LEVEL: { status: 422, description: 'Already at the maximum level (D08/D09).' },
  ALREADY_COMPLETED: { status: 409, description: 'The action completed before the request (D08).' },
  RESEARCH_BUSY: { status: 409, description: 'Another research is in progress (D09).' },
  UNIT_LOCKED: { status: 422, description: 'Unit type not unlocked yet (D10).' },
  UNITS_UNAVAILABLE: { status: 422, description: 'Requested units are not in the garrison (D11).' },
  ARMY_NOT_HOME: { status: 409, description: 'Army must be at home for this action (D11).' },
  FORMATION_LOCKED: { status: 422, description: 'Formation not unlocked yet (D11).' },
  MOVEMENT_ALREADY_ARRIVED: { status: 409, description: 'Movement arrived before the recall (D12).' },
  TARGET_ALREADY_COMPLETED: { status: 409, description: 'Ability target completed first (D14, post-MVP).' },
} as const satisfies Record<string, { status: number; description: string }>;

export type ErrorCode = keyof typeof ERROR_CODES;
export const ErrorCodeSchema = z.enum(Object.keys(ERROR_CODES) as [ErrorCode, ...ErrorCode[]]);
export const errorStatus = (code: ErrorCode): number => ERROR_CODES[code].status;

/** The single error format of the API (CLAUDE.md §8). */
export const ErrorResponse = z
  .object({
    error: z.object({
      code: ErrorCodeSchema,
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
      requestId: z.string(),
    }),
  })
  .meta({ id: 'ErrorResponse', description: 'Every non-2xx response has this shape.' });
export type ErrorResponse = z.infer<typeof ErrorResponse>;
