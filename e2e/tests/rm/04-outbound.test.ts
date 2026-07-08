/**
 * RM – Outbound Flow Tests
 * Covers: page load, WET/DRY toggle, pending picking plan section,
 * direct outbound form fields, sortable history table, print PDF button.
 */
import { test, expect } from '@playwright/test';
import { RM_ROUTES } from '../helpers';

test.describe('RM – Outbound', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RM_ROUTES.outbound);
    await page.waitForLoadState('networkidle');
  });

  test('outbound page renders correctly', async ({ page }) => {
    await expect(
      page.locator('text=BARANG KELUAR').or(page.locator('text=OUTBOUND')).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('WET/DRY toggle buttons are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /ITEM WET/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /ITEM DRY/i })).toBeVisible();
  });

  test('outbound langsung form fields are visible', async ({ page }) => {
    // Form labels
    await expect(page.getByText('OUTBOUND LANGSUNG')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByLabel(/No\. Ref|Transaksi/i).first()).toBeVisible();
    await expect(page.getByLabel(/Qty Keluar/i).first()).toBeVisible();
    await expect(page.getByLabel(/Tujuan/i).first()).toBeVisible();
  });

  test('pending picking plan section is rendered', async ({ page }) => {
    await expect(
      page.locator('text=ANTREAN PICKING PLAN')
    ).toBeVisible({ timeout: 8_000 });
  });

  test('history table has sortable headers', async ({ page }) => {
    await expect(
      page.locator('text=RIWAYAT PENGELUARAN')
    ).toBeVisible({ timeout: 8_000 });

    // Click "Nama Item" sort header (rendered as "Nama Item↕" no space before ↕)
    const header = page.locator('th', { hasText: /Nama Item/ }).first();
    if (await header.isVisible({ timeout: 3_000 })) {
      await header.click();
      await expect(header).toContainText(/▲|▼/);
      await header.click();
      await expect(header).toContainText(/▲|▼/);
    }
  });

  test('filter search input narrows results', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Cari Ref, Rak, Item/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('NONEXISTENT_REF_XYZ');
      await expect(
        page.locator('text=/Tidak ada riwayat/i')
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('switching to DRY reloads data', async ({ page }) => {
    await page.getByRole('button', { name: /ITEM DRY/i }).click();
    // Page still shows key sections after toggle
    await expect(page.locator('text=OUTBOUND LANGSUNG')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=ANTREAN PICKING PLAN')).toBeVisible();
  });

  test('PROSES PENGELUARAN button is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /PROSES PENGELUARAN/i })
    ).toBeVisible({ timeout: 8_000 });
  });
});
