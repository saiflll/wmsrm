/**
 * FG Authentication Setup
 *
 * Strategy: directly POST to the backend API to get a JWT token,
 * then inject it into localStorage so all FG tests skip the login UI.
 *
 * FG Backend: http://localhost:3003
 * FG Frontend (proxied): http://localhost:3004/api → http://localhost:3003
 */
import { test as setup, expect, request } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { FG_SUPERVISOR } from '../helpers';

const storageFile = path.join(__dirname, '../../auth/fg-storage.json');

// Direct backend URL for token acquisition
const FG_BACKEND_URL = 'http://localhost:3003';

setup('authenticate as FG Supervisor', async ({ page }) => {
  // Ensure auth directory exists
  const authDir = path.dirname(storageFile);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  // ── Step 1: Get token via direct API call ────────────────────────
  const apiCtx = await request.newContext({ baseURL: FG_BACKEND_URL });
  let token: string;
  let user: object;

  try {
    const resp = await apiCtx.post('/auth/login', {
      data: { username: FG_SUPERVISOR.username, password: FG_SUPERVISOR.password },
    });

    if (!resp.ok()) {
      const body = await resp.text();
      throw new Error(`Login API returned ${resp.status()}: ${body}`);
    }

    const payload = await resp.json();
    // FG auth returns { access_token, user } directly
    const data = payload?.data ?? payload;
    token = data?.access_token;
    user = data?.user ?? {};

    if (!token) throw new Error('No access_token in response: ' + JSON.stringify(data));
    console.log('✓ FG token obtained for user:', (user as any)?.namaUser ?? FG_SUPERVISOR.username);
  } finally {
    await apiCtx.dispose();
  }

  // ── Step 2: Inject token into browser localStorage ───────────────
  await page.goto('/login');
  await page.evaluate(
    ({ t, u }) => {
      localStorage.setItem('fg_token', t);
      localStorage.setItem('fg_user', JSON.stringify(u));
    },
    { t: token, u: user },
  );

  // Verify the dashboard is accessible with the injected token
  await page.goto('/fg/dashboard');
  await expect(page).toHaveURL(/fg\/dashboard/, { timeout: 15_000 });

  // ── Step 3: Save storage state ───────────────────────────────────
  await page.context().storageState({ path: storageFile });
  console.log('✓ FG auth state saved to', storageFile);
});
