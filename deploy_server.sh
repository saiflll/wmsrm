#!/bin/bash

# ========================================================
#   Auto-Deploy WMS to Server (172.20.100.11)
# ========================================================

echo "--- [1/6] Restoring tracked files & pulling latest code ---"
# Kembalikan semua file yang terhapus (akibat cleanup sebelumnya)
git checkout -- .
# Pull dari GitHub
git pull origin main || echo "[WARNING] Git pull failed, attempting to continue..."

echo "--- [2/6] Updating IP addresses to 172.20.100.11 ---"
sed -i 's/localhost/172.20.100.11/g' docker-compose.yml
sed -i 's/localhost/172.20.100.11/g' .env

echo "--- [3/6] Building and Running Docker ---"
docker compose down
docker compose build --no-cache
docker compose up -d

echo "--- [4/6] Pruning unused Docker images ---"
docker image prune -f
docker builder prune -f

echo "--- [5/6] Cleaning up source directory ---"
# Hapus file/folder besar yang ga perlu untuk runtime
# Tapi pertahankan yang esensial: .env, docker-compose.yml, deploy_server.sh, .git
find . -maxdepth 1 ! -name '.env' \
               ! -name 'docker-compose.yml' \
               ! -name 'deploy_server.sh' \
               ! -name '.git' \
               ! -name '.' \
               -exec rm -rf {} +

echo "--- [6/6] Setting permissions ---"
chmod +x deploy_server.sh

echo "========================================================"
echo "   DEPLOYMENT SELESAI!"
echo "   Server IP: 172.20.100.11"
echo "   Data DB aman di volume 'postgres_data'."
echo "========================================================"