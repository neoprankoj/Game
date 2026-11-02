import type { MailMessage } from './mailer';

// Plain-text account emails. Wording is deliberately neutral: no email says whether some OTHER address exists.
const SIGNATURE = '\n\n— Chronos Cradle';

export const verifyEmail = (to: string, link: string): MailMessage => ({
  kind: 'verify-email',
  to,
  subject: 'Confirm your Chronos Cradle account',
  text: `Welcome, commander.\n\nConfirm your email address to activate your account:\n${link}\n\nThe link is valid for 24 hours. If you did not sign up, ignore this email.${SIGNATURE}`,
  link,
});

export const resetPassword = (to: string, link: string): MailMessage => ({
  kind: 'reset-password',
  to,
  subject: 'Reset your Chronos Cradle password',
  text: `Someone asked to reset the password of this account:\n${link}\n\nThe link is valid for 1 hour and signs out all your devices once used. If this was not you, ignore this email; your password is unchanged.${SIGNATURE}`,
  link,
});

/** Sent when someone tries to sign up with an address that already has an account (enumeration-safe sign-up). */
export const existingAccount = (to: string): MailMessage => ({
  kind: 'existing-account',
  to,
  subject: 'Your Chronos Cradle account already exists',
  text: `Someone tried to create a new account with this email address, but you already have one.\n\nIf it was you, sign in instead, or use "Forgot password" to set a new password. If it was not you, no action is needed.${SIGNATURE}`,
});
