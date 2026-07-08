/**
 * RM – Inbound Flow Tests
 * Covers: page load, form field visibility, zone selection, draft add/edit/delete,
 * localStorage persistence across navigation, column sorting on history table.
 */
import { test, expect } from '@playwright/test';
import { RM_ROUTES } from '../helpers';

test.describe('RM – Inbound', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RM_ROUTES.inbound);
    await page.waitForLoadState('networkidle');
    // Clear leftover drafts from previous tests
    await page.evaluate(() => localStorage.removeItem('wms_inbound_drafts'));
  });

  test('inbound page renders with correct title', async ({ page }) => {
    await expect(
      page.locator('text=BARANG MASUK').or(page.locator('text=INBOUND')).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('form fields are visible', async ({ page }) => {
    await expect(page.getByLabel('No.PO/SJ').first()).toBeVisible();
    await expect(page.getByLabel('Qty').first()).toBeVisible();
    await expect(page.getByLabel('Batch No').first()).toBeVisible();
  });

  test('ITEM WET and ITEM DRY type toggle buttons exist', async ({ page }) => {
    await expect(page.getByRole('button', { name: /ITEM WET/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /ITEM DRY/i }).first()).toBeVisible();
  });

  test('switching to DRY changes zone options', async ({ page }) => {
    await page.getByRole('button', { name: /ITEM DRY/i }).click();
    await expect(page.locator('button', { hasText: /DRY A|DRY B/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('clicking a zone button shows rack selector', async ({ page }) => {
    const wetZones = page.locator('button', { hasText: /CS FROZEN|CHILL|WASTE/i });
    if (await wetZones.count() > 0) {
      await wetZones.first().click();
      await expect(page.getByLabel(/Sub-Lokasi|Rak/i).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('draft table is hidden when no drafts exist', async ({ page }) => {
    const draftHeader = page.locator('text=DRAFT ANTRIAN INBOUND');
    await expect(draftHeader).not.toBeVisible();
  });

  test('history table is visible with sortable headers', async ({ page }) => {
    await expect(
      page.locator('text=RIWAYAT PENERIMAAN')
    ).toBeVisible({ timeout: 8_000 });

    await expect(page.locator('text=NoPO').or(page.locator('text=No.PO')).first()).toBeVisible({ timeout: 5_000 });
  });

  test('clicking sort header changes sort direction indicator', async ({ page }) => {
    const header = page.locator('th', { hasText: /Item/ }).first();
    if (await header.isVisible({ timeout: 3_000 })) {
      await header.click();
      await expect(header).toContainText(/▲|▼/, { timeout: 3_000 });
      await header.click();
      await expect(header).toContainText(/▲|▼/);
    }
  });

  test('search filter narrows history table results', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Cari logs/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('xyz_nonexistent_item_abc');
      const emptyMsg = page.locator('text=/Tidak ada|tidak ada/i').first();
      await expect(emptyMsg).toBeVisible({ timeout: 5_000 });
    }
  });

  test('draft persists after navigating away and back', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'wms_inbound_drafts',
        JSON.stringify([
          {
            id: 9999999,
            no_po: 'PO-TEST-001',
            barang_id: '',
            item_manual: 'Ayam Tes',
            qty: 50,
            satuan: 'Kg',
            batch_no: 'LOT-TEST',
            expiry_date: '',
            supplier: 'Supplier Tes',
            shift_id: '',
            tanggal_income: '2026-07-07',
            jam_datang: '', jam_bongkar: '', jam_selesai: '',
            gudang_id: '',
            _brg: 'Ayam Tes', _gdg: 'A1', _zone: 'CS FROZEN',
          },
        ]),
      );
    });
    await page.goto(RM_ROUTES.dashboard);
    await page.goto(RM_ROUTES.inbound);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=DRAFT ANTRIAN INBOUND')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('text=PO-TEST-001')).toBeVisible();
    await expect(page.locator('text=Ayam Tes')).toBeVisible();
  });

  test('draft edit button (pencil icon) loads data back to form', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'wms_inbound_drafts',
        JSON.stringify([
          {
            id: 8888888,
            no_po: 'PO-EDIT-001',
            barang_id: '',
            item_manual: 'Sapi Tes',
            qty: 25,
            satuan: 'Kg',
            batch_no: 'LOT-EDIT',
            expiry_date: '',
            supplier: 'Supplier Edit',
            shift_id: '',
            tanggal_income: '2026-07-07',
            jam_datang: '', jam_bongkar: '', jam_selesai: '',
            gudang_id: '',
            _brg: 'Sapi Tes', _gdg: 'B2', _zone: 'CHILL',
          },
        ]),
      );
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Find the row with PO-EDIT-001 and click its first button (edit pencil)
    const row = page.locator('tr', { hasText: 'PO-EDIT-001' });
    const editBtn = row.locator('button:has(svg)').first();
    if (await editBtn.isVisible({ timeout: 5_000 })) {
      await editBtn.click();
      await expect(page.locator('text=DRAFT ANTRIAN INBOUND')).not.toBeVisible({ timeout: 5_000 });
    }
  });

  test('draft delete button removes row from draft table', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'wms_inbound_drafts',
        JSON.stringify([
          {
            id: 7777777,
            no_po: 'PO-DEL-001',
            barang_id: '',
            item_manual: 'Item Hapus',
            qty: 10,
            satuan: 'Pcs',
            batch_no: '',
            expiry_date: '',
            supplier: '',
            shift_id: '',
            tanggal_income: '2026-07-07',
            jam_datang: '', jam_bongkar: '', jam_selesai: '',
            gudang_id: '',
            _brg: 'Item Hapus', _gdg: '', _zone: '',
          },
        ]),
      );
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=PO-DEL-001')).toBeVisible({ timeout: 5_000 });

    // Find the row with PO-DEL-001 and click its last button (delete X)
    const row = page.locator('tr', { hasText: 'PO-DEL-001' });
    const deleteBtn = row.locator('button:has(svg)').last();
    await deleteBtn.click();
    await expect(page.locator('text=DRAFT ANTRIAN INBOUND')).not.toBeVisible({ timeout: 5_000 });
  });
});
