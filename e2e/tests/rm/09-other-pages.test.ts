/**
 * RM – Inventory, Relocation, Stock Opname, Reports Tests
 */
import { test, expect } from '@playwright/test';
import { RM_ROUTES } from '../helpers';

// ────────────────────────────────────────────────────────────────
test.describe('RM – Inventory Matrix', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RM_ROUTES.inventory);
    await page.waitForLoadState('networkidle');
  });

  test('inventory page renders', async ({ page }) => {
    await expect(
      page.locator('h1, h2, h3, h4').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('inventory table or matrix is present', async ({ page }) => {
    const table = page.locator('table').first();
    await expect(table).toBeVisible({ timeout: 10_000 });
  });
});

// ────────────────────────────────────────────────────────────────
test.describe('RM – Relocation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RM_ROUTES.relocation);
    await page.waitForLoadState('networkidle');
  });

  test('relocation page renders with heading', async ({ page }) => {
    await expect(
      page.locator('h1, h2, h3, h4').filter({ hasText: /Relocation|Mutasi|Pindah/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('form inputs are visible', async ({ page }) => {
    // Should have at least one Select or TextInput for source rack
    const inputs = page.locator('input, select').first();
    await expect(inputs).toBeVisible({ timeout: 8_000 });
  });

  test('history table is present', async ({ page }) => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ────────────────────────────────────────────────────────────────
test.describe('RM – Stock Opname', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RM_ROUTES.stockOpname);
    await page.waitForLoadState('networkidle');
  });

  test('stock opname page renders', async ({ page }) => {
    await expect(
      page.locator('h1, h2, h3, h4').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('zone buttons are visible', async ({ page }) => {
    // Initial load shows zone selection buttons, not a data table
    await expect(page.getByRole('button', { name: /CS FROZEN|CHILL|DRY A|DRY B/ }).first()).toBeVisible({ timeout: 10_000 });
  });
});

// ────────────────────────────────────────────────────────────────
test.describe('RM – Report Inbound', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RM_ROUTES.reportInbound);
    await page.waitForLoadState('networkidle');
  });

  test('report inbound page renders', async ({ page }) => {
    await expect(page.locator('h1, h2, h3, h4').first()).toBeVisible({ timeout: 10_000 });
  });

  test('filter or date range control exists', async ({ page }) => {
    const control = page.locator('input[type="date"], input[type="month"]').first();
    await expect(control).toBeVisible({ timeout: 8_000 });
  });

  test('table is rendered', async ({ page }) => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ────────────────────────────────────────────────────────────────
test.describe('RM – Report Outbound', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RM_ROUTES.reportOutbound);
    await page.waitForLoadState('networkidle');
  });

  test('report outbound page renders', async ({ page }) => {
    await expect(page.locator('h1, h2, h3, h4').first()).toBeVisible({ timeout: 10_000 });
  });

  test('table is rendered', async ({ page }) => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ────────────────────────────────────────────────────────────────
test.describe('RM – Report Opname', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RM_ROUTES.reportOpname);
    await page.waitForLoadState('networkidle');
  });

  test('report opname page renders', async ({ page }) => {
    await expect(page.locator('h1, h2, h3, h4').first()).toBeVisible({ timeout: 10_000 });
  });

  test('table is rendered', async ({ page }) => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });
});
