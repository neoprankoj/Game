import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { linkFromMailbox } from './mailbox';

// Part 2.8 on the web build against the real API: every step goes through the UI, emails come from the dev mailbox.
const PASSWORD = 'correct horse battery';

async function signUpAndVerify(page: Page, email: string): Promise<void> {
  await page.goto('/sign-up');
  await page.getByTestId('email').fill(email);
  await page.getByTestId('password').fill(PASSWORD);
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('check-email')).toContainText(email);
  await page.goto(await linkFromMailbox(email, 'verify-email')); // the API verifies and redirects to the app
  await expect(page.getByTestId('session')).toHaveText(`Signed in as ${email}`);
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByTestId('email').fill(email);
  await page.getByTestId('password').fill(password);
  await page.getByTestId('submit').click();
}

const newEmail = () => `e2e-${randomUUID().slice(0, 8)}@example.com`;

test('sign up, confirm by email, see the account, sign out, sign back in', async ({ page }) => {
  const email = newEmail();
  await signUpAndVerify(page, email);

  await page.getByTestId('to-account').click();
  await expect(page.getByTestId('account-email')).toHaveText(email); // GET /account: a protected route
  await expect(page.getByTestId('account-role')).toHaveText('Role: player');

  await page.getByTestId('sign-out').click();
  await expect(page.getByTestId('session')).toHaveText('Not signed in');
  await page.goto('/account');
  await expect(page.getByTestId('account-error')).toHaveText('Sign in to see your account.');

  await signIn(page, email, PASSWORD);
  await expect(page.getByTestId('account-email')).toHaveText(email);
});

test('a wrong password and an unknown email show the same message', async ({ page }) => {
  const email = newEmail();
  await signUpAndVerify(page, email);
  await page.getByTestId('to-account').click();
  await page.getByTestId('sign-out').click();
  await expect(page.getByTestId('session')).toHaveText('Not signed in');

  await signIn(page, email, 'not my password');
  await expect(page.getByTestId('form-error')).toHaveText('Email or password is wrong.');
  await signIn(page, newEmail(), 'not my password');
  await expect(page.getByTestId('form-error')).toHaveText('Email or password is wrong.');
});

test('sign-in before confirming the email explains what to do', async ({ page }) => {
  const email = newEmail();
  await page.goto('/sign-up');
  await page.getByTestId('email').fill(email);
  await page.getByTestId('password').fill(PASSWORD);
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('check-email')).toBeVisible();
  await signIn(page, email, PASSWORD);
  await expect(page.getByTestId('form-error')).toHaveText(
    'Confirm your email address first. We just sent you a new link.',
  );
  // The re-sent link returns to this web app and signs the user in.
  const link = await linkFromMailbox(email, 'verify-email');
  expect(new URL(link).searchParams.get('callbackURL')).toMatch(/^http:\/\/127\.0\.0\.1:4319\//);
  await page.goto(link);
  await expect(page.getByTestId('session')).toHaveText(`Signed in as ${email}`);
});

test('forgot password: emailed link, new password, old one refused', async ({ page }) => {
  const email = newEmail();
  await signUpAndVerify(page, email);
  await page.goto('/forgot-password');
  await page.getByTestId('email').fill(email);
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('reset-requested')).toBeVisible();

  await page.goto(await linkFromMailbox(email, 'reset-password')); // API → /reset-password?token=…
  await expect(page).toHaveURL(/\/reset-password\?token=/);
  await page.getByTestId('password').fill('a brand new passphrase');
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('reset-done')).toBeVisible();

  await signIn(page, email, PASSWORD);
  await expect(page.getByTestId('form-error')).toHaveText('Email or password is wrong.');
  await signIn(page, email, 'a brand new passphrase');
  await expect(page.getByTestId('account-email')).toHaveText(email);
});

test('delete the account (password required); the email can no longer sign in', async ({ page }) => {
  const email = newEmail();
  await signUpAndVerify(page, email);
  await page.getByTestId('to-account').click();

  await page.getByTestId('delete-password').fill('not my password');
  await page.getByTestId('delete-account').click();
  await expect(page.getByTestId('form-error')).toHaveText('Email or password is wrong.');

  await page.getByTestId('delete-password').fill(PASSWORD);
  await page.getByTestId('delete-account').click();
  await expect(page.getByTestId('session')).toHaveText('Not signed in');
  await signIn(page, email, PASSWORD);
  await expect(page.getByTestId('form-error')).toHaveText('Email or password is wrong.');
});
