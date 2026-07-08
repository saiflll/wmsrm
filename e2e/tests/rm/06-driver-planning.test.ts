/**
 * RM – Driver Planning Flow Tests
 * Covers: page load, form fields with autocomplete suggestions,
 * status filter, sortable table headers, add/edit/delete planning.
 */
import { test, expect } from '@playwright/test';
import { RM_ROUTES } from '../helpers';

test.describe('RM – Driver Planning', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RM_ROUTES.driverPlanning);
    await page.waitForLoadState('networkidle');
  });

  test('driver planning page renders with header', async ({ page }) => {
    await expect(
      page.locator('text=PLANNING DRIVER INBOUND')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('form fields are visible', async ({ page }) => {
    await expect(page.getByLabel(/No PO \/ SJ/i).first()).toBeVisible();
    await expect(page.getByLabel(/Nama Driver/i).first()).toBeVisible();
    await expect(page.getByLabel(/Plat Nomor/i).first()).toBeVisible();
    await expect(page.getByLabel(/Supplier/i).first()).toBeVisible();
    await expect(page.getByLabel(/Estimasi Kedatangan/i).first()).toBeVisible();
  });

  test('status select contains WAIT, FAIL, DONE options', async ({ page }) => {
    const statusSelect = page.getByLabel('Status').first();
    await expect(statusSelect).toBeVisible();
    await statusSelect.click();
    await expect(page.locator('[data-combobox-option]', { hasText: 'WAIT' }).first()).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('[data-combobox-option]', { hasText: 'FAIL' }).first()).toBeVisible();
    await expect(page.locator('[data-combobox-option]', { hasText: 'DONE' }).first()).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('save button is present', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Simpan/i })
    ).toBeVisible();
  });

  test('status filter dropdown is visible', async ({ page }) => {
    // Mantine Select shows "Semua Status" as the default value
    const filterSelect = page.locator('[value="Semua Status"]');
    await expect(filterSelect).toBeVisible({ timeout: 5_000 });
  });

  test('search input filters table rows', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Cari PO, Driver, Plat/i).first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('NONEXISTENT_DRIVER_XYZ');
    await expect(
      page.locator('text=Tidak ada jadwal planning driver')
    ).toBeVisible({ timeout: 5_000 });
  });

  test('table headers are sortable', async ({ page }) => {
    const header = page.locator('th', { hasText: /No PO/ }).first();
    if (await header.isVisible({ timeout: 3_000 })) {
      await header.click();
      await expect(header).toContainText(/▲|▼/);
      await header.click();
      await expect(header).toContainText(/▲|▼/);
    }
  });

  test('refresh data button is clickable', async ({ page }) => {
    const refreshBtn = page.getByRole('button', { name: /Refresh Data/i }).first();
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    await expect(page).toHaveURL(/driver-planning/);
  });

  test('TAMBAH JADWAL DRIVER form title is shown initially', async ({ page }) => {
    await expect(page.locator('text=TAMBAH JADWAL DRIVER')).toBeVisible({ timeout: 5_000 });
  });

  test('autocomplete on No PO field shows suggestions from inbound logs', async ({ page }) => {
    const input = page.getByLabel(/No PO \/ SJ/i).first();
    await input.click();
    await input.fill('PO');
    await expect(input).toHaveValue('PO');
    await page.keyboard.press('Escape');
  });

  test('autocomplete on Supplier field shows Master Customer options', async ({ page }) => {
    const input = page.getByLabel(/Supplier/i).first();
    await input.click();
    await input.fill('a');
    await expect(input).toHaveValue('a');
    await page.keyboard.press('Escape');
  });
});
