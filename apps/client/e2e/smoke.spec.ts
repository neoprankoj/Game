import { expect, test, type Page } from '@playwright/test';

/** Fails the test on any console error or uncaught exception in the page. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('home loads and shows the live API status from the real backend', async ({ page }) => {
  const errors = watchErrors(page);
  const apiCalls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes(':3919/')) apiCalls.push(new URL(r.url()).pathname);
  });
  await page.goto('/');
  await expect(page.getByTestId('api-status')).toHaveText('API: online');
  await expect(page.getByTestId('api-ready')).toHaveText('ready · database up · redis up');
  expect(apiCalls).toEqual(expect.arrayContaining(['/health', '/ready']));
  expect(errors).toEqual([]);
});

test('navigates to sign-in and back', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.getByTestId('session')).toHaveText('Not signed in');
  await page.getByTestId('to-sign-in').click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByTestId('email')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('api-status')).toBeVisible();
  expect(errors).toEqual([]);
});

test('shows a loading state, then an error state with a working retry when the API is unreachable', async ({
  page,
}) => {
  let block = true;
  let releaseHealth: () => void = () => undefined;
  const healthGate = new Promise<void>((resolve) => {
    releaseHealth = resolve;
  });
  await page.route('**/health', async (route) => {
    await healthGate; // hold the first request so the loading state is observable
    if (block) await route.abort('connectionrefused');
    else await route.continue();
  });
  await page.goto('/');
  await expect(page.getByTestId('loading')).toBeVisible();
  releaseHealth();
  await expect(page.getByTestId('api-status')).toHaveText('API: unreachable');
  block = false;
  await page.getByTestId('retry').click();
  await expect(page.getByTestId('api-status')).toHaveText('API: online');
});

test('unknown routes show the not-found screen', async ({ page }) => {
  await page.goto('/this/does/not/exist');
  await expect(page.getByText('This screen does not exist.')).toBeVisible();
});
