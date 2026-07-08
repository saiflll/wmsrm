/**
 * FG – Dashboard Tests
 * Covers: page load, navigation sidebar, key menu items, nav interactions.
 */
import { test, expect } from '@playwright/test';
import { FG_ROUTES } from '../helpers';

test.describe('FG – Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FG_ROUTES.dashboard);
    await page.waitForLoadState('networkidle');
  });

  test('dashboard page loads', async ({ page }) => {
    await expect(
      page.locator('h1, h2, h3, h4').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('FG WMS title is present in header', async ({ page }) => {
    await expect(page.locator('text=FG WMS')).toBeVisible({ timeout: 8_000 });
  });

  test('sidebar shows Barang Masuk and Barang Keluar for Supervisor', async ({ page }) => {
    const sidebar = page.locator('.mantine-AppShell-navbar, nav').first();
    await expect(sidebar.locator('text=Barang Masuk').first()).toBeVisible({ timeout: 5_000 });
    await expect(sidebar.locator('text=Barang Keluar').first()).toBeVisible({ timeout: 5_000 });
  });

  test('sidebar links navigate correctly', async ({ page }) => {
    // Click the actual nav link element using its href attribute directly
    const link = page.locator('nav a[href="/fg/barang-masuk"], .mantine-AppShell-navbar a[href="/fg/barang-masuk"]').first();
    await link.click();
    await expect(page).toHaveURL(/fg\/barang-masuk/);
  });

  test('supervisor sees all menu items', async ({ page }) => {
    const sidebar = page.locator('.mantine-AppShell-navbar, nav').first();
    for (const label of ['Dashboard', 'Stock', 'Report', 'Master Barang']) {
      await expect(sidebar.locator(`text=${label}`).first()).toBeVisible({ timeout: 5_000 });
    }
  });
});
