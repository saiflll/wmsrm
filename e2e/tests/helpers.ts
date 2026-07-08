/**
 * Shared test helpers and constants for WMS Playwright tests.
 */

// ── RM Credentials (from seed.service.ts) ────────────────────────
// Super Admin: superadmin / super123
export const RM_ADMIN = { username: 'superadmin', password: 'super123' };
export const RM_CHECKER_IB = { username: 'checkerib1', password: 'checker123' };
export const RM_CHECKER_OB = { username: 'checkerob1', password: 'checker123' };
export const RM_SUPERVISOR = { username: 'supervisor', password: 'super123' };

// ── FG Credentials (from fg-users.service.ts seedDefaults) ────────
// Supervisor: spv / spv123   |   Admin IT: admin / admin123
export const FG_SUPERVISOR = { username: 'spv', password: 'spv123' };
export const FG_KOORDINATOR_IN = { username: 'in1', password: 'in123' };
export const FG_KOORDINATOR_OUT = { username: 'out1', password: 'out123' };

// ── RM Routes ─────────────────────────────────────────────────────
export const RM_ROUTES = {
  login: '/login',
  dashboard: '/wms/dashboard',
  driverPlanning: '/wms/driver-planning',
  inbound: '/wms/inbound',
  outbound: '/wms/outbound',
  relocation: '/wms/relocation',
  picking: '/wms/picking',
  stockOpname: '/wms/stock-opname',
  inventory: '/wms/inventory',
  reportInbound: '/wms/report-inbound',
  reportOutbound: '/wms/report-outbound',
  reportOpname: '/wms/report-opname',
  masterProduk: '/wms/master-produk',
  masterLokasi: '/wms/master-lokasi',
  masterCustomer: '/wms/master-customer',
  users: '/wms/users',
  loginLogs: '/wms/login-logs',
};

// ── FG Routes ─────────────────────────────────────────────────────
export const FG_ROUTES = {
  login: '/login',
  dashboard: '/fg/dashboard',
  barangMasuk: '/fg/barang-masuk',
  barangKeluar: '/fg/barang-keluar',
  otdr: '/fg/otdr',
  pickingList: '/fg/picking-list',
  mutasi: '/fg/mutasi',
  qcFifo: '/fg/qc-fifo',
  stock: '/fg/stock',
  scan: '/fg/scan',
  stockOpname: '/fg/stock-opname',
  relocation: '/fg/relocation',
  adminIt: '/fg/admin-it',
  report: '/fg/report',
  masterBarang: '/fg/master-barang',
  masterRak: '/fg/master-rak',
  masterResto: '/fg/master-resto',
  users: '/fg/users',
};

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Wait for a Mantine notification toast to appear.
 */
export async function waitForNotification(page: any, text: string, timeout = 8000) {
  await page.locator('.mantine-Notification-root').filter({ hasText: text }).first().waitFor({ timeout });
}

/**
 * Fill a Mantine Select (combobox) by clicking it, typing, then clicking the first suggestion.
 */
export async function fillSelect(page: any, label: string, value: string) {
  const input = page.getByLabel(label);
  await input.click();
  await input.fill(value);
  await page.locator('[data-combobox-option]').filter({ hasText: value }).first().click();
}

/**
 * Fill a Mantine Autocomplete input.
 */
export async function fillAutocomplete(page: any, label: string, value: string) {
  const input = page.getByLabel(label);
  await input.fill(value);
}

/**
 * Set localStorage for RM authentication (bypasses the UI login step in tests
 * that use a pre-authenticated state).
 */
export async function setRmAuth(page: any, token: string, user: object) {
  await page.addInitScript(
    ({ t, u }: { t: string; u: object }) => {
      localStorage.setItem('token', t);
      localStorage.setItem('user', JSON.stringify(u));
    },
    { t: token, u: user },
  );
}

/**
 * Set localStorage for FG authentication.
 */
export async function setFgAuth(page: any, token: string, user: object) {
  await page.addInitScript(
    ({ t, u }: { t: string; u: object }) => {
      localStorage.setItem('fg_token', t);
      localStorage.setItem('fg_user', JSON.stringify(u));
    },
    { t: token, u: user },
  );
}
