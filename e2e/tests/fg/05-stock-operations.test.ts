/**
 * FG – Stock, Mutasi, QC FIFO, Relocation, Stock Opname Tests
 */
import { test, expect } from '@playwright/test';
import { FG_ROUTES } from '../helpers';

// ────────────────────────────────────────────────────────────────
test.describe('FG – Stock', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FG_ROUTES.stock);
    await page.waitForLoadState('networkidle');
  });

  test('stock page renders', async ({ page }) => {
    await expect(page.locator('h1, h2, h3, h4').first()).toBeVisible({ timeout: 10_000 });
  });

  test('stock table is present', async ({ page }) => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });

  test('search or filter input exists', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder]').first();
    await expect(searchInput).toBeVisible({ timeout: 8_000 });
  });
});

// ────────────────────────────────────────────────────────────────
test.describe('FG – Mutasi', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FG_ROUTES.mutasi);
    await page.waitForLoadState('networkidle');
  });

  test('mutasi page renders', async ({ page }) => {
    await expect(page.locator('h1, h2, h3, h4').first()).toBeVisible({ timeout: 10_000 });
  });

  test('form fields are present', async ({ page }) => {
    const input = page.locator('input').first();
    await expect(input).toBeVisible({ timeout: 8_000 });
  });

  test('table is rendered', async ({ page }) => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ────────────────────────────────────────────────────────────────
test.describe('FG – QC FIFO', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FG_ROUTES.qcFifo);
    await page.waitForLoadState('networkidle');
  });

  test('QC FIFO page renders', async ({ page }) => {
    await expect(page.locator('h1, h2, h3, h4').first()).toBeVisible({ timeout: 10_000 });
  });

  test('FIFO table or data list is present', async ({ page }) => {
    const table = page.locator('table, [role="grid"], ul').first();
    await expect(table).toBeVisible({ timeout: 10_000 });
  });
});

// ────────────────────────────────────────────────────────────────
test.describe('FG – Relocation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FG_ROUTES.relocation);
    await page.waitForLoadState('networkidle');
  });

  test('relocation page renders', async ({ page }) => {
    await expect(page.locator('h1, h2, h3, h4').first()).toBeVisible({ timeout: 10_000 });
  });

  test('source and destination rack selects exist', async ({ page }) => {
    const inputs = page.locator('input, select');
    await expect(inputs.first()).toBeVisible({ timeout: 8_000 });
  });

  test('relocation history table is present', async ({ page }) => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ────────────────────────────────────────────────────────────────
test.describe('FG – Stock Opname / Update Lokasi', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FG_ROUTES.stockOpname);
    await page.waitForLoadState('networkidle');
  });

  test('stock opname page renders', async ({ page }) => {
    await expect(page.locator('h1, h2, h3, h4').first()).toBeVisible({ timeout: 10_000 });
  });

  test('table with rack data is present', async ({ page }) => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });
});
