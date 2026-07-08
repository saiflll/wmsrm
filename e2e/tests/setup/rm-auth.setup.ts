/**
 * RM Authentication Setup
 *
 * Strategy: directly POST to the backend API to get a JWT token,
 * then inject it into localStorage so all RM tests skip the login UI.
 *
 * RM Backend: http://localhost:3001
 * RM Frontend (proxied): http://localhost:3005/api → http://localhost:3001
 */
import { test as setup, expect, request } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { RM_ADMIN } from '../helpers';

const storageFile = path.join(__dirname, '../../auth/rm-storage.json');

// Direct backend URL for token acquisition
const RM_BACKEND_URL = 'http://localhost:3001';

setup('authenticate as RM Super Admin', async ({ page }) => {
  // Ensure auth directory exists
  const authDir = path.dirname(storageFile);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  // ── Step 1: Get token via direct API call ────────────────────────
  const apiCtx = await request.newContext({ baseURL: RM_BACKEND_URL });
  let token: string;
  let user: object;

  try {
    const resp = await apiCtx.post('/auth/login', {
      data: { username: RM_ADMIN.username, password: RM_ADMIN.password },
    });

    if (!resp.ok()) {
      const body = await resp.text();
      throw new Error(`Login API returned ${resp.status()}: ${body}`);
    }

    const payload = await resp.json();
    // Handle TransformInterceptor wrapper { data: { access_token, user } }
    const data = payload?.data ?? payload;
    token = data?.access_token;
    user = data?.user ?? {};

    if (!token) throw new Error('No access_token in response: ' + JSON.stringify(data));
    console.log('✓ RM token obtained for user:', (user as any)?.username ?? RM_ADMIN.username);
  } finally {
    await apiCtx.dispose();
  }

  // ── Step 2: Inject token into browser localStorage ───────────────
  await page.goto('/login');
  await page.evaluate(
    ({ t, u }) => {
      localStorage.setItem('token', t);
      localStorage.setItem('user', JSON.stringify(u));
    },
    { t: token, u: user },
  );

  // Verify the dashboard is accessible with the injected token
  await page.goto('/wms/dashboard');
  await expect(page).toHaveURL(/wms\/dashboard/, { timeout: 15_000 });

  // ── Step 3: Save storage state ───────────────────────────────────
  await page.context().storageState({ path: storageFile });
  console.log('✓ RM auth state saved to', storageFile);
});
