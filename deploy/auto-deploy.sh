#!/bin/bash

# Script Deployment Otomatis (di Server)
echo "============================================="
echo "   Auto-Deploy WMS PRO (172.20.100.11)"
echo "============================================="

echo "1. Menghentikan container yang sedang berjalan..."
docker-compose down || docker compose down

echo "2. Memasukkan (load) image dari file .tar..."
docker load -i WMS_Containers.tar

echo "3. Menjalankan container di background..."
docker-compose up -d || docker compose up -d

echo "4. Membersihkan image lama yang tidak terpakai..."
docker image prune -f

echo "============================================="
echo "   DEPLOYMENT SELESAI!"
echo "   Silakan buka: http://"
echo "============================================="