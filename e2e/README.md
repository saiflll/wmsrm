# WMS E2E Test Suite – Playwright

Playwright end-to-end tests for both **Raw Materials (RM)** and **Finished Goods (FG)** WMS applications.

---

## Project Structure

```
e2e/
├── playwright.config.ts          # Main Playwright config (two projects: rm / fg)
├── package.json
├── auth/                         # Auto-generated auth state files (gitignore these!)
│   ├── rm-storage.json
│   └── fg-storage.json
└── tests/
    ├── helpers.ts                # Shared constants, selectors, and utility functions
    ├── setup/
    │   ├── rm-auth.setup.ts      # RM login → saves browser storage state
    │   └── fg-auth.setup.ts      # FG login → saves browser storage state
    ├── rm/
    │   ├── 01-auth.test.ts       # RM: Login / Logout flow
    │   ├── 02-dashboard.test.ts  # RM: Dashboard & navigation
    │   ├── 03-inbound.test.ts    # RM: Inbound (drafts, localStorage, sort)
    │   ├── 04-outbound.test.ts   # RM: Outbound (form, history, sort)
    │   ├── 05-picking.test.ts    # RM: Picking Plan (drafts, edit, sort)
    │   ├── 06-driver-planning.test.ts  # RM: Driver Planning CRUD + autocomplete
    │   ├── 07-master-data.test.ts      # RM: Master Produk / Lokasi / Customer
    │   ├── 08-users-logs.test.ts       # RM: Users management + Login Logs
    │   └── 09-other-pages.test.ts      # RM: Inventory, Relocation, Opname, Reports
    └── fg/
        ├── 01-auth.test.ts             # FG: Login / Logout flow
        ├── 02-dashboard.test.ts        # FG: Dashboard & sidebar
        ├── 03-barang-masuk.test.ts     # FG: Barang Masuk (inbound + batch/rack)
        ├── 04-barang-keluar.test.ts    # FG: Barang Keluar, Picking List, OTDR
        ├── 05-stock-operations.test.ts # FG: Stock, Mutasi, QC FIFO, Relocation
        ├── 06-master-admin.test.ts     # FG: Master Barang/Rak/Resto, Admin, Users
        └── 07-occupancy-scanner.test.ts# FG: Occupancy & Scanner pages
```

---

## Prerequisites

| Service | URL | Notes |
|---|---|---|
| RM Backend | `http://localhost:3001` | NestJS API |
| RM Frontend | `http://localhost:3000` | Next.js dev server |
| FG Backend | `http://localhost:3002` | NestJS API |
| FG Frontend | `http://localhost:3004` | Next.js dev server (`npm run dev -p 3004`) |

> Both frontend **dev servers must be running** before executing tests.

---

## Quick Start

### 1. Install dependencies

```bash
cd e2e
npm install
npx playwright install chromium
```

### 2. Configure credentials

Open [`tests/helpers.ts`](./tests/helpers.ts) and update the credential constants to match your local environment:

```ts
// RM Credentials
export const RM_ADMIN = { username: 'admin', password: 'admin123' };

// FG Credentials
export const FG_SUPERVISOR = { username: 'supervisor', password: 'super123' };
```

### 3. Run all tests

```bash
# First-time: run auth setup projects to generate storage state files
npx playwright test --project=rm-setup
npx playwright test --project=fg-setup

# Then run all tests
npm test
```

### 4. Run individual project

```bash
npm run test:rm    # RM tests only
npm run test:fg    # FG tests only
```

### 5. View HTML report

```bash
npm run report
```

---

## Test Strategy

| Category | Approach |
|---|---|
| **Auth flows** | Full login/logout without pre-saved state (`storageState: {cookies:[], origins:[]}`) |
| **Authenticated pages** | Uses saved storage state (`auth/rm-storage.json` / `auth/fg-storage.json`) to skip login |
| **localStorage persistence** | `page.evaluate()` injects draft data; navigates away then back to verify retention |
| **Sortable headers** | Clicks column headers and asserts `▲`/`▼` indicator appears |
| **CRUD modals** | Opens add/edit modal via button, verifies form inputs, closes with Escape |
| **Notifications** | Asserts `.mantine-Notification-root` appears on submit/error |
| **Draft editing** | Injects draft via `localStorage`, verifies edit button restores form and removes draft row |

---

## Notes

- Tests run in **serial** (`fullyParallel: false`, `workers: 1`) to avoid port conflicts and auth state race conditions.
- Screenshots and videos are captured automatically on test failures inside `playwright-report/`.
- Add `auth/` to `.gitignore` to avoid committing tokens.
