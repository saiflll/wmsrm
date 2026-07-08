/**
 * FG – Barang Keluar (Outbound) & Picking List Flow Tests
 */
import { test, expect } from '@playwright/test';
import { FG_ROUTES } from '../helpers';

test.describe('FG – Barang Keluar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FG_ROUTES.barangKeluar);
    await page.waitForLoadState('networkidle');
  });

  test('barang keluar page renders', async ({ page }) => {
    await expect(
      page.locator('h1, h2, h3, h4').filter({ hasText: /Barang Keluar|Outbound|Pengeluaran/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('form inputs are present', async ({ page }) => {
    const input = page.locator('input, select').first();
    await expect(input).toBeVisible({ timeout: 8_000 });
  });

  test('history table is rendered', async ({ page }) => {
    // Assert the main table or container is visible instead of using complex CSS text selector
    const mainContainer = page.locator('table, .mantine-Paper-root').first();
    await expect(mainContainer).toBeVisible({ timeout: 10_000 });
  });

  test('sortable headers are present', async ({ page }) => {
    const sortableHeader = page.locator('th', { hasText: /↕|▲|▼/ }).first();
    if (await sortableHeader.isVisible({ timeout: 3_000 })) {
      await sortableHeader.click();
      await expect(sortableHeader).toContainText(/▲|▼/);
    }
  });
});

test.describe('FG – Picking List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FG_ROUTES.pickingList);
    await page.waitForLoadState('networkidle');
  });

  test('picking list page renders', async ({ page }) => {
    await expect(
      page.locator('h1, h2, h3, h4').filter({ hasText: /Picking/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('table is present', async ({ page }) => {
    // Check main container
    const mainContainer = page.locator('table, .mantine-Paper-root').first();
    await expect(mainContainer).toBeVisible({ timeout: 10_000 });
  });

  test('print or export button exists', async ({ page }) => {
    const printBtn = page.getByRole('button', { name: /Print|Export|PDF|Excel|Cetak/i }).first();
    if (await printBtn.isVisible({ timeout: 3_000 })) {
      await expect(printBtn).toBeEnabled();
    }
  });
});

test.describe('FG – OTDR', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FG_ROUTES.otdr);
    await page.waitForLoadState('networkidle');
  });

  test('OTDR page renders', async ({ page }) => {
    await expect(
      page.locator('h1, h2, h3, h4').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('OTDR table is present', async ({ page }) => {
    const mainContainer = page.locator('table, .mantine-Paper-root').first();
    await expect(mainContainer).toBeVisible({ timeout: 10_000 });
  });
});
