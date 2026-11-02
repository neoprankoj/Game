import { ApiClientError, authErrorCode, PASSWORD_MIN_LENGTH, type ClientErrorCode } from '@chronos/contracts';

/** What the player reads for each error code (one place; translations come with 12.2). */
const MESSAGES: Partial<Record<ClientErrorCode, string>> = {
  AUTH_INVALID_CREDENTIALS: 'Email or password is wrong.',
  AUTH_EMAIL_NOT_VERIFIED: 'Confirm your email address first. We just sent you a new link.',
  AUTH_TOKEN_INVALID: 'This link is invalid or has expired. Ask for a new one.',
  VALIDATION_FAILED: `Check your input: a valid email and a password of at least ${String(PASSWORD_MIN_LENGTH)} characters.`,
  RATE_LIMITED: 'Too many attempts. Wait a minute and try again.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection.',
  TIMEOUT: 'The server took too long to answer. Try again.',
};

export function messageFor(code: ClientErrorCode): string {
  return MESSAGES[code] ?? 'Something went wrong. Try again.';
}

/** A Better Auth client error (`{ code, status }`) → our catalog code (contracts `authErrorCode`). */
export function codeOfAuthError(error: { code?: string | undefined; status: number }): ClientErrorCode {
  return authErrorCode(error.code, error.status);
}

export function codeOfApiError(error: unknown): ClientErrorCode {
  return error instanceof ApiClientError ? error.code : 'NETWORK_ERROR';
}
