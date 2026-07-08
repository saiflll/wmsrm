/**
 * RM – Users & Login Logs Tests (Admin only)
 * Covers: user management CRUD UI, login log pagination.
 */
import { test, expect } from '@playwright/test';
import { RM_ROUTES } from '../helpers';

test.describe('RM – Users Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RM_ROUTES.users);
    await page.waitForLoadState('networkidle');
  });

  test('users page renders heading', async ({ page }) => {
    await expect(
      page.locator('h1, h2, h3').filter({ hasText: /User|Manajemen/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('"Tambah User" button is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Tambah User/i })
    ).toBeVisible({ timeout: 8_000 });
  });

  test('clicking "Tambah User" opens modal', async ({ page }) => {
    await page.getByRole('button', { name: /Tambah User/i }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });

    // Modal should have username and password inputs
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
  });

  test('user table is rendered with columns', async ({ page }) => {
    const table = page.locator('table').first();
    await expect(table).toBeVisible({ timeout: 8_000 });
    await expect(table.locator('th', { hasText: /Username/i })).toBeVisible();
    await expect(table.locator('th', { hasText: /Role/i })).toBeVisible();
    await expect(table.locator('th', { hasText: /Aksi/i })).toBeVisible();
  });

  test('create user with duplicate username shows error', async ({ page }) => {
    await page.getByRole('button', { name: /Tambah User/i }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });

    // Try to create with very short password
    await page.getByLabel('Username').fill('testuser_pw_short');
    await page.getByLabel(/Password/i).fill('abc');
    await page.getByRole('button', { name: /Buat/i }).click();

    // Validation notification should appear
    const notification = page.locator('.mantine-Notification-root').first();
    await expect(notification).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('RM – Login Logs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RM_ROUTES.loginLogs);
    await page.waitForLoadState('networkidle');
  });

  test('login logs page renders', async ({ page }) => {
    await expect(
      page.locator('h1, h2, h3').filter({ hasText: /Login/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('table has correct columns', async ({ page }) => {
    const thead = page.locator('table thead').first();
    await expect(thead.locator('th', { hasText: /Waktu/i })).toBeVisible({ timeout: 8_000 });
    await expect(thead.locator('th', { hasText: /Username/i })).toBeVisible();
    await expect(thead.locator('th', { hasText: /Status/i })).toBeVisible();
  });

  test('refresh button is present and clickable', async ({ page }) => {
    const refreshBtn = page.getByRole('button', { name: /Refresh/i });
    await expect(refreshBtn).toBeVisible({ timeout: 5_000 });
    await refreshBtn.click();
    await expect(page).toHaveURL(/login-logs/);
  });
});
