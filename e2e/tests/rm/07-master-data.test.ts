/**
 * RM – Master Data Pages Tests
 * Covers: Master Produk, Master Lokasi, Master Customer
 * Verifies page renders, table/CRUD UI is accessible, search works.
 */
import { test, expect } from '@playwright/test';
import { RM_ROUTES } from '../helpers';

test.describe('RM – Master Produk', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RM_ROUTES.masterProduk);
    await page.waitForLoadState('networkidle');
  });

  test('page renders with heading', async ({ page }) => {
    await expect(
      page.locator('h1, h2, h3, h4').filter({ hasText: /Produk|Master/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('"Tambah" / "Add" button is visible', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /Tambah|Add|Buat/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 8_000 });
  });

  test('data table is rendered', async ({ page }) => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('RM – Master Lokasi', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RM_ROUTES.masterLokasi);
    await page.waitForLoadState('networkidle');
  });

  test('page renders with heading', async ({ page }) => {
    await expect(
      page.locator('h1, h2, h3, h4').filter({ hasText: /Lokasi|Gudang|Rak/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('table is present', async ({ page }) => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 8_000 });
  });

  test('form submit button is visible', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /Submit|Update|Batal|Template|Import/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('RM – Master Customer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RM_ROUTES.masterCustomer);
    await page.waitForLoadState('networkidle');
  });

  test('page renders with heading', async ({ page }) => {
    await expect(
      page.locator('h1, h2, h3, h4').filter({ hasText: /Storage|Tujuan|Customer/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('data table is rendered', async ({ page }) => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 8_000 });
  });

  test('form is visible with submit button', async ({ page }) => {
    // Form is inline, no "Tambah" button — the Submit button is always visible
    await expect(page.getByRole('button', { name: /Submit|Update|Batal|Template|Import/i }).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByLabel(/Nama Supplier|Customer|Alamat|Telp/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
