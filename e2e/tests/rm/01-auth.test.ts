/**
 * RM – Authentication Flow Tests
 * Covers: login (success/fail), logout, redirect-to-login guard.
 *
 * NOTE: RM login uses Mantine PasswordInput which wraps <input type="password">
 * inside a div. getByLabel('Password') won't match the inner input in all
 * Playwright versions, so we use locator('input[type="password"]') instead.
 */
import { test, expect } from '@playwright/test';
import { RM_ADMIN, RM_ROUTES } from '../helpers';

// Tests in this file deliberately do NOT use the saved storageState
// so they can verify the login/logout mechanics independently.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('RM – Login / Logout', () => {
  test('renders login page with WMS title', async ({ page }) => {
    await page.goto(RM_ROUTES.login);
    await expect(page.locator('h1, h2, h3', { hasText: /WMS Login/i })).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Masuk/i })).toBeVisible();
  });

  test('shows error notification on invalid credentials', async ({ page }) => {
    await page.goto(RM_ROUTES.login);
    await page.getByLabel('Username').fill('wrong_user');
    await page.locator('input[type="password"]').fill('bad_pass');
    await page.getByRole('button', { name: /Masuk/i }).click();

    // Should stay on login page
    await expect(page).not.toHaveURL('**/wms/dashboard');
    // Mantine notification should appear with error
    await expect(
      page.locator('.mantine-Notification-root, [data-notification]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('redirects unauthenticated user from /wms/dashboard to /login', async ({ page }) => {
    await page.goto(RM_ROUTES.dashboard);
    await page.waitForURL('**/login', { timeout: 8_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('successful login → redirects to dashboard', async ({ page }) => {
    await page.goto(RM_ROUTES.login);
    await page.getByLabel('Username').fill(RM_ADMIN.username);
    await page.locator('input[type="password"]').fill(RM_ADMIN.password);
    await page.getByRole('button', { name: /Masuk/i }).click();
    await page.waitForURL('**/wms/dashboard', { timeout: 20_000 });
    await expect(page).toHaveURL(/wms\/dashboard/);
  });

  test('logout clears session and redirects to login', async ({ page }) => {
    // Login first
    await page.goto(RM_ROUTES.login);
    await page.getByLabel('Username').fill(RM_ADMIN.username);
    await page.locator('input[type="password"]').fill(RM_ADMIN.password);
    await page.getByRole('button', { name: /Masuk/i }).click();
    await page.waitForURL('**/wms/dashboard', { timeout: 20_000 });

    // Click LOGOUT button in header
    await page.getByRole('button', { name: /LOGOUT/i }).click();
    await page.waitForURL('**/login', { timeout: 8_000 });
    await expect(page).toHaveURL(/\/login/);

    // Confirm token is cleared
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });
});
