import { describe, expect, it } from 'vitest';
import { authErrorCode, EmailAddress, Password, PASSWORD_MIN_LENGTH } from '../src';

describe('auth contract (Part 2.8)', () => {
  it('maps wrong password and unknown email to the SAME code (no account enumeration)', () => {
    expect(authErrorCode('INVALID_EMAIL_OR_PASSWORD', 401)).toBe('AUTH_INVALID_CREDENTIALS');
    expect(authErrorCode('INVALID_PASSWORD', 400)).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('maps verification, token and policy errors to catalog codes', () => {
    expect(authErrorCode('EMAIL_NOT_VERIFIED', 403)).toBe('AUTH_EMAIL_NOT_VERIFIED');
    expect(authErrorCode('INVALID_TOKEN', 400)).toBe('AUTH_TOKEN_INVALID');
    expect(authErrorCode('PASSWORD_TOO_SHORT', 400)).toBe('VALIDATION_FAILED');
    expect(authErrorCode('SESSION_EXPIRED', 400)).toBe('UNAUTHENTICATED');
  });

  it('falls back by HTTP status for codes it does not know', () => {
    expect(authErrorCode(undefined, 429)).toBe('RATE_LIMITED');
    expect(authErrorCode('SOMETHING_NEW', 401)).toBe('UNAUTHENTICATED');
    expect(authErrorCode('SOMETHING_NEW', 403)).toBe('FORBIDDEN');
    expect(authErrorCode('SOMETHING_NEW', 502)).toBe('INTERNAL_ERROR');
    expect(authErrorCode('SOMETHING_NEW', 400)).toBe('VALIDATION_FAILED');
  });

  it('states the D01 password policy (≥ 10 characters)', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
    expect(Password.safeParse('123456789').success).toBe(false);
    expect(Password.safeParse('1234567890').success).toBe(true);
    expect(Password.safeParse('x'.repeat(129)).success).toBe(false);
    expect(EmailAddress.safeParse('pilot@example.com').success).toBe(true);
    expect(EmailAddress.safeParse('not-an-email').success).toBe(false);
  });
});
