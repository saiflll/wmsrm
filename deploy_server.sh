#!/bin/bash

# ========================================================
#   Auto-Deploy WMS to Server (172.20.100.11)
# ========================================================

echo "--- [1/5] Pulling latest code from GitHub ---"
# Pastikan folder ini adalah repo git
if [ ! -d ".git" ]; then
    echo "[INFO] .git folder not found. Make sure you are in the correct directory."
fi

# Pull from GitHub
git pull origin main || echo "[WARNING] Git pull failed, attempting to continue..."

echo "--- [2/5] Updating IP addresses to 172.20.100.11 ---"
# Replace localhost with server IP in critical files
# Menggunakan sed (Stream Editor) yang standar di Linux
sed -i 's/localhost/172.20.100.11/g' docker-compose.yml
sed -i 's/localhost/172.20.100.11/g' .env

echo "--- [3/5] Building and Running Docker (No Cache) ---"
# Down containers (tetap mempertahankan volume data)
docker compose down

# Build tanpa cache agar perubahan kode terbaru masuk
docker compose build --no-cache

# Jalankan di background
docker compose up -d

echo "--- [4/5] Pruning unused Docker images ---"
docker image prune -f

echo "--- [5/5] Cleaning up Docker build cache ---"
docker builder prune -f

echo "========================================================"
echo "   DEPLOYMENT SELESAI!"
echo "   Server IP: 172.20.100.11"
echo "   Data DB aman di volume 'postgres_data'."
echo "========================================================"
