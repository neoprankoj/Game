import { ApiClientError } from '@chronos/contracts';
import { describe, expect, it } from 'vitest';
import { codeOfApiError, codeOfAuthError, messageFor } from './errors';

describe('client error messages (Part 2.8)', () => {
  it('shows one message for wrong password and unknown email', () => {
    expect(messageFor(codeOfAuthError({ code: 'INVALID_EMAIL_OR_PASSWORD', status: 401 }))).toBe(
      'Email or password is wrong.',
    );
  });

  it('explains unconfirmed emails, bad links and rate limits', () => {
    expect(messageFor(codeOfAuthError({ code: 'EMAIL_NOT_VERIFIED', status: 403 }))).toMatch(
      /Confirm your email/,
    );
    expect(messageFor(codeOfAuthError({ code: 'INVALID_TOKEN', status: 400 }))).toMatch(
      /invalid or has expired/,
    );
    expect(messageFor(codeOfAuthError({ code: undefined, status: 429 }))).toMatch(/Too many attempts/);
  });

  it('maps typed-client failures and has a fallback for everything else', () => {
    expect(codeOfApiError(new ApiClientError('UNAUTHENTICATED', 'x', 401))).toBe('UNAUTHENTICATED');
    expect(codeOfApiError(new Error('boom'))).toBe('NETWORK_ERROR');
    expect(messageFor('INTERNAL_ERROR')).toBe('Something went wrong. Try again.');
  });
});
