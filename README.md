# WMS PRO — Enterprise Warehouse Management System

Sistem Manajemen Gudang (Warehouse Management System) modern skala industri berbasis Web dengan arsitektur terisolasi (Frontend Next.js + Backend NestJS + Database PostgreSQL). Dirancang untuk efisiensi tinggi, pelacakan stok real-time, manajemen lokasi rak gudang, alur outbound ayam, serta visualisasi indikator KPI operasional.

---

## 🚀 Teknologi & Tech Stack

| Layer | Teknologi & Library Utama |
| :--- | :--- |
| **Frontend Framework** | **Next.js 15** (App Router), **React 19**, **TypeScript** |
| **UI Design System** | **Mantine UI v7**, Vanilla CSS custom design, **Tabler Icons** |
| **Backend Framework** | **NestJS 11**, **TypeORM**, **Class-Validator**, **Passport JWT** |
| **Database & Cache** | **PostgreSQL 15 Alpine** |
| **DevOps & Container** | **Docker**, **Docker Compose**, **GitHub Actions (Self-Hosted CI/CD)** |

---

## ⚡ Fitur Utama & Modul Sistem

### 📊 1. Executive & Operations Dashboard
- **Okupansi per Zone**: Visualisasi *Radial Gauges* real-time ketersediaan rak pada Zone CS FROZEN, CHILL, DRY A, DRY B, DRY FG, dan WASTE.
- **Analisis OFTI & Serapan Ayam**: Grafik tren mingguan pencapaian *On-Time Full Inbound* & serapan produk ayam harian.
- **Mutasi Terbaru & Ekspor CSV**: Riwayat log transaksi pergerakan barang terbaru dengan sorting kolom dinamis & fitur filter tanggal ekspor CSV.

### 📦 2. Manajemen Inbound & Outbound
- **Planning Inbound & Active Processing**: Alokasi perencanaan penerimaan barang PO, klaim rak otomatis berdasarkan jenis/zona, dan verifikasi waktu bongkar.
- **Planning Outbound & History**: Pembuatan draf pengeluaran barang dengan sugesti stok & zona yang tersedia (`available_qty > 0`), ekspor cetak PDF draf resmi.
- **Planning & Outbound Ayam**: Modul khusus penanganan pergerakan produk ayam dengan pencatatan alokasi *Terserap*, *Waste*, dan *Reject*.

### 🏬 3. Gudang, Stok & Relokasi
- **Relokasi Stok (Inter-Rack Movement)**: Perpindahan stok antar rak/zona dengan draf perencanaan dan eksekusi massal, dilengkapi cetak laporan riwayat relokasi PDF terisolasi & filter rentang tanggal.
- **Stock Opname**: Manajemen penyesuaian fisik stok gudang per zona dan pembuatan laporan selisih opname.
- **Inventory Matrix**: Visualisasi pemetaan rak gudang 2D/3D (Tampak Samping & Atas) secara interaktif.

### 🛡️ 4. Matriks Role & Keamanan (Role-Based Access Control)
Sistem memiliki 6 hirarki hak akses pengguna yang terenkripsi dan terverifikasi secara ketat pada level UI maupun Endpoint API NestJS Guards:

| ID Role | Nama Role | Cakupan Hak Akses & Fitur |
| :---: | :--- | :--- |
| `1` | **Checker** | Modul Perencanaan (*Planning Inbound, Planning Outbound, Planning Ayam*), Dashboard, & About System. |
| `2` | **Admin** | Modul Perencanaan (*Planning Inbound, Planning Outbound, Planning Ayam*), Dashboard, & About System. |
| `3` | **Koordinator** | Seluruh alur operasional realisasi (*Inbound, Outbound, Relokasi, Opname, Laporan Lengkap*), Perencanaan, & Dashboard. |
| `4` | **Supervisor** | Supervisi penuh operasional gudang, Perencanaan, Laporan, dan Master Data (*Produk, Lokasi, Customer*). |
| `5` | **Super Admin** | Akses Absolut tanpa batasan (*Termasuk Manajemen User, Riwayat Login, dan Import Data Massal*). |
| `6` | **Manager** | Hak akses eksekutif *Read-Only* khusus untuk pemantauan KPI Dashboard & About System. |

---

## 📁 Struktur Direktori Repositori

```text
wms-master/
├── rm/
│   ├── frontend/            # Next.js App Router (Client & UI Components)
│   │   ├── app/
│   │   │   ├── (wms)/       # Main Application Layout & Protected Pages
│   │   │   │   ├── dashboard/         # Dashboard Monitoring & Custom Gauges
│   │   │   │   ├── planning-inbound/  # Planning Inbound & Active Drafts
│   │   │   │   ├── inbound/           # Realisasi Penerimaan Raw Materials
│   │   │   │   ├── planning-outbound/ # Planning Outbound & Draft PDF Print
│   │   │   │   ├── outbound/          # Realisasi Pengeluaran Raw Materials
│   │   │   │   ├── planning-ayam/     # Perencanaan Outbound Produk Ayam
│   │   │   │   ├── outbound-ayam/     # Eksekusi Outbound Ayam
│   │   │   │   ├── relocation/        # Perencanaan & Eksekusi Relokasi Stok
│   │   │   │   ├── stock-opname/      # Pelaksanaan Stock Opname
│   │   │   │   ├── report-*/          # Laporan Inbound, Outbound, Ayam, Opname
│   │   │   │   └── about/             # About System & Developer Contacts
│   │   └── lib/             # API Axios Interceptors & Helper Functions
│   │
│   └── backend/             # NestJS Server (Modular Architecture)
│       └── src/
│           ├── admin/       # Auth (JWT, Roles Guard), Users, Login Logs
│           ├── master/      # Master Barang, Gudang, Customers, Shifts
│           ├── inbound/     # Inbound Planning & Execution Logic
│           ├── outbound/    # Outbound Planning & History Processing
│           ├── ayam/        # Planning Ayam & Outbound Ayam Services
│           └── management/  # Relocation, Inventory Matrix, Dashboard Analytics
│
├── deploy/                  # Script Deployment & Configuration Tools
├── docker-compose.yml       # Docker Services Orchestration (DB, Backend, Frontend)
└── README.md                # Dokumentasi Resmi Proyek WMS PRO
```

---

## ⚙️ Panduan Menjalankan Aplikasi

### 1. Prasyarat Sistem
- **Node.js** v18+ atau **Docker & Docker Compose**
- **PostgreSQL 15** (Jika dijalankan tanpa Docker)

### 2. Jalankan dengan Docker Compose (Rekomendasi)
```bash
# Build dan jalankan seluruh service container
docker-compose up --build -d
```

Setelah container berhasil menyala:
- 🌐 **Frontend App**: [http://localhost:3015](http://localhost:3015) (Atau Port `:3001`)
- ⚙️ **Backend API**: [http://localhost:3014/api](http://localhost:3014/api) (Atau Port `:3002`)
- 🗄️ **Database PostgreSQL**: `localhost:4321`

### 3. Akun Pengujian Bawaan (Default Users)

| Username | Password | Role ID | Nama Role |
| :--- | :--- | :---: | :--- |
| `checker` | `checker123` | `1` | Checker |
| `admin` | `admin123` | `2` | Admin |
| `koordinator` | `koord123` | `3` | Koordinator |
| `supervisor` | `super123` | `4` | Supervisor |
| `superadmin` | `super123` | `5` | Super Admin |
| `manager` | `manager123` | `6` | Manager |

---

## 🔄 Deployment Otomatis (CI/CD)

Proyek ini telah terintegrasi dengan **GitHub Actions** menggunakan *Self-Hosted Runner* untuk deployment otomatis tanpa *downtime*:
1. Setiap perintah `git push` ke branch `master` akan mentrigger workflow `.github/workflows/deploy.yml`.
2. Workflow akan menyusun environment, membangun image Docker frontend & backend terbaru, serta melakukan migrasi data tanpa menghapus (*persisted volume*) container database PostgreSQL.

---

*WMS PRO — Enterprise Warehouse Management System | Developed with Next.js, NestJS, Mantine UI & TypeORM*