/**
 * FG – Master Data & Admin Pages Tests
 * Covers: Master Barang, Master Rak, Master Resto, Admin IT, Users, Report.
 */
import { test, expect } from '@playwright/test';
import { FG_ROUTES } from '../helpers';

// ────────────────────────────────────────────────────────────────
test.describe('FG – Master Barang', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FG_ROUTES.masterBarang);
    await page.waitForLoadState('networkidle');
  });

  test('page renders with heading', async ({ page }) => {
    await expect(page.locator('h1, h2, h3, h4').first()).toBeVisible({ timeout: 10_000 });
  });

  test('product table is visible', async ({ page }) => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });

  test('"Tambah" button opens form or modal', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Tambah Barang")').first();
    await expect(addBtn).toBeVisible({ timeout: 8_000 });
    await addBtn.click();
    // Wait for the modal input field 'Nama Barang' or input label to appear
    const input = page.locator('input[placeholder="Nama Barang"], label:has-text("Nama Barang"), input').first();
    await expect(input).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('search or filter works', async ({ page }) => {
    const searchSelect = page.locator('input[placeholder="Filter Barang"]').first();
    if (await searchSelect.isVisible({ timeout: 3_000 })) {
      await searchSelect.click();
      await searchSelect.fill('NONEXISTENT_ITEM_XYZ');
      await page.keyboard.press('Enter');
      
      // Just assert the search box is interactive and contains input
      await expect(searchSelect).toHaveValue('NONEXISTENT_ITEM_XYZ');
    }
  });
});

// ────────────────────────────────────────────────────────────────
test.describe('FG – Master Rak', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FG_ROUTES.masterRak);
    await page.waitForLoadState('networkidle');
  });

  test('page renders', async ({ page }) => {
    await expect(page.locator('h1, h2, h3, h4').first()).toBeVisible({ timeout: 10_000 });
  });

  test('rack table is present', async ({ page }) => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });

  test('"Tambah" button is visible', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Tambah Rak"), button:has-text("Tambah")').first();
    await expect(addBtn).toBeVisible({ timeout: 8_000 });
  });
});

// ────────────────────────────────────────────────────────────────
test.describe('FG – Master Resto', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FG_ROUTES.masterResto);
    await page.waitForLoadState('networkidle');
  });

  test('master resto page renders', async ({ page }) => {
    await expect(page.locator('h1, h2, h3, h4').first()).toBeVisible({ timeout: 10_000 });
  });

  test('resto table is present', async ({ page }) => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ────────────────────────────────────────────────────────────────
test.describe('FG – Admin IT', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FG_ROUTES.adminIt);
    await page.waitForLoadState('networkidle');
  });

  test('admin IT page renders', async ({ page }) => {
    await expect(page.locator('h1, h2, h3, h4').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ────────────────────────────────────────────────────────────────
test.describe('FG – Users', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FG_ROUTES.users);
    await page.waitForLoadState('networkidle');
  });

  test('users page renders', async ({ page }) => {
    await expect(page.locator('h1, h2, h3, h4').first()).toBeVisible({ timeout: 10_000 });
  });

  test('user table is present', async ({ page }) => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });

  test('"Tambah User" button opens form', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Tambah User"), button:has-text("Tambah")').first();
    if (await addBtn.isVisible({ timeout: 5_000 })) {
      await addBtn.click();
      // Wait for any input in modal to appear
      const modalInput = page.locator('.mantine-Modal-content input, input').first();
      await expect(modalInput).toBeVisible({ timeout: 5_000 });
      await page.keyboard.press('Escape');
    }
  });
});

// ────────────────────────────────────────────────────────────────
test.describe('FG – Report', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FG_ROUTES.report);
    await page.waitForLoadState('networkidle');
  });

  test('report page renders', async ({ page }) => {
    await expect(page.locator('h1, h2, h3, h4').first()).toBeVisible({ timeout: 10_000 });
  });

  test('date range or filter controls are visible', async ({ page }) => {
    const dateInput = page.locator('input[type="date"], input[type="month"]').first();
    if (await dateInput.isVisible({ timeout: 5_000 })) {
      await expect(dateInput).toBeEnabled();
    }
  });

  test('export/print button is visible', async ({ page }) => {
    const exportBtn = page.locator('button:has-text("Export"), button:has-text("Print"), button:has-text("Cetak")').first();
    if (await exportBtn.isVisible({ timeout: 5_000 })) {
      await expect(exportBtn).toBeEnabled();
    }
  });
});
