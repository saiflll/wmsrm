# WMS — Warehouse Management System

Sistem Manajemen Gudang berbasis web dengan arsitektur monolitik terpisah (Frontend + Backend + Database).

## Tech Stack

| Layer      | Teknologi                                                              |
|------------|------------------------------------------------------------------------|
| **Frontend** | Next.js 15 (App Router), React 19, Mantine UI 7, Axios, Tabler Icons  |
| **Backend**  | NestJS 11, TypeORM, PostgreSQL, Passport JWT, bcrypt, Class-Validator |
| **Database** | PostgreSQL 15 Alpine                                                   |
| **DevOps**   | Docker Compose, Multi-stage Build                                      |

## Fitur & Modul

### Backend Modules (`backend/src/`)
| Modul         | Fungsi                              |
|---------------|-------------------------------------|
| `auth`        | Autentikasi JWT (Login/Register)    |
| `users`       | Manajemen user & role               |
| `barang`      | Master barang / produk              |
| `items`       | Item inventory                      |
| `inventory`   | Stok inventory & pergerakan         |
| `gudang`      | Master lokasi / gudang              |
| `customers`   | Master pelanggan                    |
| `suplayers`   | Master supplier                     |
| `shifts`      | Manajemen shift kerja               |
| `hardware`    | Manajemen perangkat keras           |
| `transaksi`   | Transaksi inbound/outbound          |

### Frontend Pages (`frontend/app/`)
| Route                        | Halaman                  |
|------------------------------|--------------------------|
| `/login`                     | Login user               |
| `/barang`                    | Master barang            |
| `/wms/dashboard`             | Dashboard utama WMS      |
| `/wms/inbound`               | Penerimaan barang        |
| `/wms/inventory`             | Data inventory           |
| `/wms/master-produk`         | Master produk            |
| `/wms/master-customer`       | Master customer          |
| `/wms/master-lokasi`         | Master lokasi gudang     |
| `/wms/picking`               | Proses picking           |
| `/wms/putaway`               | Proses putaway           |
| `/wms/relocation`            | Relokasi stok            |
| `/wms/stock-opname`          | Stock opname             |
| `/wms/report-inbound`        | Report inbound           |
| `/wms/report-outbound`       | Report outbound          |
| `/wms/report-opname`         | Report stock opname      |

## Cara Menjalankan

### Prasyarat
- Docker & Docker Compose terinstal
- Clone repository ini

### Jalankan dengan Docker Compose
```bash
docker-compose up --build
```

Setelah build selesai:
| Service    | URL                                    |
|------------|----------------------------------------|
| **Frontend**  | [http://localhost:3001](http://localhost:3001) |
| **Backend API** | [http://localhost:3002](http://localhost:3002) |
| **Database**   | `localhost:4321` (PostgreSQL 15)        |

> ⚠️ **Catatan Port:** Frontend di `:3001`, Backend di `:3002`, Database di `:4321`.

## Struktur Folder
```
/backend          — NestJS application (auth, users, barang, inventory, dll)
/frontend         — Next.js App Router dengan Mantine UI
/deploy           — File dan script deploy (Docker, batch, PowerShell)
/ui               — Asset UI tambahan
docker-compose.yml — Orkestrasi container (db, backend, frontend)
.env              — Environment variables (DB, JWT, dll.)
```

## Konfigurasi
Edit file `.env` untuk mengubah:
- Kredensial database (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`)
- Secret key JWT (`JWT_SECRET`)
- Port service

### Akun Default
| Username    | Password      | Role         |
|-------------|---------------|--------------|
| `foreman1`  | `foreman123`  | Foreman      |
| `admin1`    | `admin123`    | Admin        |
| `superadmin`| `super123`    | Super Admin  |

## Deployment & CI/CD

Projek ini dikonfigurasi untuk melakukan deployment otomatis ke server melalui **GitHub Actions** dengan **Self-hosted Runner**:

### 1. Arsitektur API Universal (Next.js Rewrites)
Frontend telah dikonfigurasi untuk memanggil API secara relatif (`/api`). Next.js menggunakan fitur `rewrites` untuk meneruskan request dari `/api/*` ke URL backend (container `backend:3002`) secara internal. Ini meniadakan kebutuhan hardcode alamat IP server di frontend.

### 2. GitHub Actions Workflow (`.github/workflows/deploy.yml`)
Setiap kali Anda melakukan `git push` ke branch `master` atau `main`, GitHub Actions akan memicu runner mandiri di server untuk:
1. Menulis file `.env` secara otomatis dari GitHub Secret (`ENV_FILE`).
2. Menghentikan dan menghapus container `wms_frontend` dan `wms_backend` yang sedang berjalan agar terhindar dari konflik nama.
3. Melakukan rebuild frontend dan backend.
4. Menjalankan Docker compose dengan bendera `--no-recreate` agar container database `wms_db` **tetap dipertahankan (tidak dihapus/dibuat ulang)**. Dengan cara ini, data lama Anda di database tetap aman dan utuh.
5. Seeding data baru secara otomatis saat backend baru menyala.
6. Membersihkan Docker cache yang tidak terpakai (`prune`).

### 3. Setup Awal di GitHub
Sebelum melakukan push pertama kali, pastikan Anda telah mengatur hal berikut di repositori GitHub Anda (`ppa-project/wms`):
- **GitHub Secret**: Masuk ke **Settings > Secrets and variables > Actions > New repository secret**. Tambahkan secret bernama `ENV_FILE` dan isi dengan nilai konfigurasi `.env` produksi Anda.
- **Runner**: Pastikan self-hosted runner di server Anda (`dt-svr-ck3` di folder `~/ren`) sudah berjalan menggunakan perintah `nohup ./run.sh &`.

---
*WMS — Warehouse Management System | Built with Next.js, NestJS, Mantine UI & PostgreSQL*