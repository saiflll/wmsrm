@echo off
cd /d "%~dp0"

echo ========================================================
echo   Proses Ekspor Container WMS App menjadi .tar
echo ========================================================

echo.
echo [1/3] Memastikan semua image sudah di-build...
docker-compose build --no-cache
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build gagal! Periksa error di atas.
    pause
    exit /b 1
)

echo.
echo [2/3] Mengekspor image menjadi file WMS_Containers.tar...
echo (Proses ini mungkin memakan waktu beberapa menit tergantung ukuran aplikasi)
docker save -o WMS_Containers.tar wms-frontend:latest wms-backend:latest postgres:15-alpine

echo.
echo [3/3] Selesai! File "WMS_Containers.tar" berhasil dibuat.
echo ========================================================
echo Silakan kirimkan file berikut ke komputer / server tujuan:
echo 1. WMS_Containers.tar
echo 2. docker-compose.yml
echo 3. .env (Jika ada konfigurasi password)
echo.
echo Untuk menjalankannya di tempat baru, penerima cukup menjalankan:
echo 1. docker load -i WMS_Containers.tar
echo 2. docker-compose up -d
echo ========================================================
pause
