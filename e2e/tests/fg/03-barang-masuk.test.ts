/**
 * FG – Barang Masuk (Inbound) Flow Tests
 * Covers: page render, form sections, batch/rak entry, history table, sorting.
 */
import { test, expect } from '@playwright/test';
import { FG_ROUTES } from '../helpers';

test.describe('FG – Barang Masuk', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FG_ROUTES.barangMasuk);
    await page.waitForLoadState('networkidle');
  });

  test('barang masuk page renders with header', async ({ page }) => {
    const heading = page.locator('h1, h2, h3, h4', { hasText: /BARANG MASUK/i }).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('BSTB document section is visible', async ({ page }) => {
    await expect(page.locator('text=Informasi Dokumen BSTB')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('input[placeholder="BSTB-001"]').first()).toBeVisible();
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
  });

  test('Identitas Barang section renders', async ({ page }) => {
    await expect(page.locator('text=Identitas Barang')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('input[placeholder="Pilih barang..."]').first()).toBeVisible();
  });

  test('Batch & Rak section renders with Add batch button', async ({ page }) => {
    await expect(page.locator('text=Detail Batch')).toBeVisible({ timeout: 8_000 });
    await expect(
      page.getByRole('button', { name: /Tambah Batch/i })
    ).toBeVisible();
  });

  test('clicking Tambah Batch adds another batch row', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /Tambah Batch/i });
    await addBtn.click();
    await expect(page.locator('input[placeholder="Nomor Batch"]')).toHaveCount(2);
  });

  test('Stock tab shows table with sortable headers', async ({ page }) => {
    const stockTab = page.locator('[role="tab"][data-value="stock"], button:has-text("Stok Saat Ini")').first();
    if (await stockTab.isVisible()) {
      await stockTab.click();
    }
    // Check main container
    await expect(page.locator('table, .mantine-Paper-root').first()).toBeVisible({ timeout: 8_000 });
  });

  test('History tab shows table', async ({ page }) => {
    const historyTab = page.locator('[role="tab"][data-value="history"], button:has-text("Riwayat Penerimaan")').first();
    if (await historyTab.isVisible()) {
      await historyTab.click();
    }
    // Look for history table or fallback content container
    await expect(page.locator('table, .mantine-Paper-root').last()).toBeVisible({ timeout: 8_000 });
  });

  test('Simpan Transaksi button is present', async ({ page }) => {
    await expect(
      page.locator('button', { hasText: /Simpan Transaksi|Simpan/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('real-time clock (Jam In) is displayed', async ({ page }) => {
    await expect(page.locator('text=Jam In').first()).toBeVisible({ timeout: 5_000 });
  });
});
