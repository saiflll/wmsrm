/**
 * FG – Authentication Flow Tests
 */
import { test, expect } from '@playwright/test';
import { FG_SUPERVISOR, FG_ROUTES } from '../helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('FG – Login / Logout', () => {
  test('renders FG login page', async ({ page }) => {
    await page.goto(FG_ROUTES.login);
    await expect(page.locator('text=FG WMS')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Login/i })).toBeVisible();
  });

  test('shows error on wrong credentials', async ({ page }) => {
    await page.goto(FG_ROUTES.login);
    await page.getByLabel('Username').fill('invalid_user');
    await page.getByLabel('Password').fill('wrong_pass');
    await page.getByRole('button', { name: /Login/i }).click();

    await expect(page).not.toHaveURL('**/fg/dashboard');
    
    // Fallback to checking body text or notification class cleanly
    const errorNotif = page.locator('.mantine-Notification-root, [role="alert"]').first();
    await expect(errorNotif).toBeVisible({ timeout: 10_000 });
  });

  test('unauthenticated access to /fg/dashboard redirects to /login', async ({ page }) => {
    await page.goto(FG_ROUTES.dashboard);
    await page.waitForURL('**/login', { timeout: 8_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('successful login redirects to FG dashboard', async ({ page }) => {
    await page.goto(FG_ROUTES.login);
    await page.getByLabel('Username').fill(FG_SUPERVISOR.username);
    await page.getByLabel('Password').fill(FG_SUPERVISOR.password);
    await page.getByRole('button', { name: /Login/i }).click();
    await page.waitForURL('**/fg/dashboard', { timeout: 15_000 });
    await expect(page).toHaveURL(/fg\/dashboard/);
  });

  test('logout clears FG session and redirects to login', async ({ page }) => {
    // Login first
    await page.goto(FG_ROUTES.login);
    await page.getByLabel('Username').fill(FG_SUPERVISOR.username);
    await page.getByLabel('Password').fill(FG_SUPERVISOR.password);
    await page.getByRole('button', { name: /Login/i }).click();
    await page.waitForURL('**/fg/dashboard', { timeout: 15_000 });

    // Click Logout
    await page.getByRole('button', { name: /Logout/i }).click();
    await page.waitForURL('**/login', { timeout: 8_000 });

    const token = await page.evaluate(() => localStorage.getItem('fg_token'));
    expect(token).toBeNull();
  });
});
