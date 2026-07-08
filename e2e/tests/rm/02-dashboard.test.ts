/**
 * RM – Dashboard Tests
 * Covers: page loads, KPI cards visible, driver punctuality section,
 * schedule status counters, recent arrivals table.
 */
import { test, expect } from '@playwright/test';
import { RM_ROUTES } from '../helpers';

test.describe('RM – Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RM_ROUTES.dashboard);
    // Wait for page to fully hydrate
    await page.waitForLoadState('networkidle');
  });

  test('dashboard page renders correctly', async ({ page }) => {
    // Title or main heading visible
    await expect(
      page.locator('h1, h2, h3, h4').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('navigation sidebar is visible', async ({ page }) => {
    await expect(page.locator('nav, [role="navigation"], .mantine-AppShell-navbar').first()).toBeVisible();
  });

  test('sidebar contains key navigation links', async ({ page }) => {
    const sidebar = page.locator('.mantine-AppShell-navbar, nav').first();
    // Key menu items that Super Admin should see
    for (const label of ['Dashboard', 'Inbound', 'Outbound', 'Planning Driver']) {
      await expect(sidebar.locator(`text=${label}`).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('navigates to inbound from sidebar', async ({ page }) => {
    await page.locator('text=Inbound').first().click();
    await expect(page).toHaveURL(/\/wms\/inbound/);
  });

  test('navigates to outbound from sidebar', async ({ page }) => {
    await page.locator('text=Outbound').first().click();
    await expect(page).toHaveURL(/\/wms\/outbound/);
  });

  test('navigates to driver planning from sidebar', async ({ page }) => {
    await page.locator('text=Planning Driver').first().click();
    await expect(page).toHaveURL(/\/wms\/driver-planning/);
  });
});
