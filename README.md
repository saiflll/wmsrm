# WMS Project Template

Template Warehouse Management System (WMS) menggunakan perpaduan **Next.js**, **NestJS**, **Mantine UI**, dan **PostgreSQL**.

## Tech Stack
- **Frontend**: Next.js 15 (App Router), Mantine UI 7, Axios, Tabler Icons.
- **Backend**: NestJS 11, TypeORM, PostgreSQL, Config Service.
- **Database**: PostgreSQL 15.
- **DevOps**: Docker Compose.

## Fitur
- [x] CRUD Inventory Items (Backend & Frontend)
- [x] Login UI Sederhana (Mantine)
- [x] Database Sync (Auto Table Creation)
- [x] Docker Containerization
- [x] CORS Enabled
- [x] Modern & Premium UI dengan Mantine Shell

## Cara Menjalankan

### 1. Clone & Setup
Pastikan Anda memiliki Docker dan Docker Compose terinstal.

### 2. Jalankan dengan Docker Compose
```bash
docker-compose up --build
```

Setelah build selesai:
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:3001](http://localhost:3001)
- **Database**: Port 5432

### 3. Struktur Folder
- `/frontend`: Next.js application dengan Mantine.
- `/backend`: NestJS application logic.
- `docker-compose.yml`: konfigurasi orkestrasi container.
- `.env`: konfigurasi environment variables.

## Konfigurasi
Anda dapat mengubah kredensial database dan JWT Secret di file `.env`.

---
*Dibuat untuk mempercepat inisialisasi project WMS.*
Username: foreman1 / Password: foreman123 (Role: Foreman)
Username: admin1 / Password: admin123 (Role: Admin)
Username: superadmin / Password: super123 (Role: Super Admin)