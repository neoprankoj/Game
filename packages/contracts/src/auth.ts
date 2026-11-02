import { z } from 'zod';
import type { ClientErrorCode } from './client';

/**
 * Authentication contract (D01, ADR-0007). Sign-up/sign-in/sign-out/reset/deletion are served by Better Auth under
 * AUTH_BASE_PATH in the LIBRARY's request/response format (ADR-0013 exception); everything else uses route
 * contracts. These constants are shared so the API, the client and the tests cannot disagree.
 */
export const AUTH_BASE_PATH = '/api/auth';
/** Native deep-link scheme (apps/client/app.json `scheme`): a trusted origin for native requests and redirects. */
export const APP_SCHEME = 'chronoscradle';
/** Session cookie prefix (`chronos.session_token`; `__Secure-` is added on https). */
export const AUTH_COOKIE_PREFIX = 'chronos';

/** D01 password policy. Hashing (scrypt) and comparison are done by the library, never by our code. */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const EMAIL_MAX_LENGTH = 254;

export const EmailAddress = z.email().max(EMAIL_MAX_LENGTH);
export const Password = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

/**
 * Maps a Better Auth error (`{ code, message }` + HTTP status) to our catalog code, so screens handle one set of
 * codes (CLAUDE.md §8: one error format). Unknown codes fall back by status. Wrong password and unknown email
 * already arrive as the same library code, so the mapping cannot leak which one it was.
 */
export function authErrorCode(libraryCode: string | undefined, status: number): ClientErrorCode {
  switch (libraryCode) {
    case 'INVALID_EMAIL_OR_PASSWORD':
    case 'INVALID_PASSWORD': // wrong current password on account deletion
    case 'CREDENTIAL_ACCOUNT_NOT_FOUND':
      return 'AUTH_INVALID_CREDENTIALS';
    case 'EMAIL_NOT_VERIFIED':
      return 'AUTH_EMAIL_NOT_VERIFIED';
    case 'INVALID_TOKEN':
    case 'TOKEN_EXPIRED':
      return 'AUTH_TOKEN_INVALID';
    case 'INVALID_EMAIL':
    case 'PASSWORD_TOO_SHORT':
    case 'PASSWORD_TOO_LONG':
    case 'VALIDATION_ERROR':
      return 'VALIDATION_FAILED';
    case 'SESSION_EXPIRED':
    case 'UNAUTHORIZED':
      return 'UNAUTHENTICATED';
    default:
      if (status === 429) return 'RATE_LIMITED';
      if (status === 401) return 'UNAUTHENTICATED';
      if (status === 403) return 'FORBIDDEN';
      if (status >= 500) return 'INTERNAL_ERROR';
      return 'VALIDATION_FAILED';
  }
}
