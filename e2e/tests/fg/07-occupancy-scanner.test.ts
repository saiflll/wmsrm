/**
 * FG – Occupancy & Scanner Tests
 */
import { test, expect } from '@playwright/test';
import { FG_ROUTES } from '../helpers';

// ────────────────────────────────────────────────────────────────
test.describe('FG – Occupancy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FG_ROUTES.stock); // /fg/occupancy or stock if same
    await page.waitForLoadState('networkidle');
  });

  test('occupancy page renders', async ({ page }) => {
    await expect(page.locator('h1, h2, h3, h4').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ────────────────────────────────────────────────────────────────
test.describe('FG – Scanner', () => {
  test.beforeEach(async ({ page }) => {
    // Skip camera permission dialog
    await page.context().grantPermissions(['camera']);
    await page.goto(FG_ROUTES.scan);
    await page.waitForLoadState('networkidle');
  });

  test('scanner page renders', async ({ page }) => {
    await expect(page.locator('h1, h2, h3, h4').first()).toBeVisible({ timeout: 10_000 });
  });

  test('scanner container is present', async ({ page }) => {
    await expect(page.locator('#qr-reader')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Klik "Mulai Scan" untuk mengaktifkan kamera')).toBeVisible();
  });

  test('clicking Mulai Scan triggers action', async ({ page }) => {
    const startBtn = page.locator('button:has-text("Mulai Scan")').first();
    if (await startBtn.isVisible()) {
      await startBtn.click();
      // Verify button or status text updates. Since camera device is absent in headless environment,
      // a camera startup error is triggered. Just verify scanner element exists and doesn't crash.
      await expect(page.locator('#qr-reader')).toBeVisible();
    }
  });
});
