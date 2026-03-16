# Script untuk persiapan deployment WMS PRO
# Melakukan penggantian IP, build docker, dan ekspor ke .tar

$TargetIP = "172.20.100.11"
$DeployDir = "$PSScriptRoot\deploy"

echo "--------------------------------------------------------"
echo "  Persiapan Deployment WMS PRO ke IP: $TargetIP"
echo "--------------------------------------------------------"

# 1. Pastikan folder deploy bersih
if (Test-Path $DeployDir) {
    echo "[1/6] Membersihkan folder deploy lama..."
    Remove-Item -Recurse -Force $DeployDir
}
New-Item -ItemType Directory -Path $DeployDir | Out-Null
echo "[1/6] Folder deploy siap."

# 2. Penggantian IP di file-file kritis (localhost/127.0.0.1 -> TargetIP)
echo "[2/6] Memperbarui alamat IP di kode sumber..."

$FilesToModify = @(
    "$PSScriptRoot\.env",
    "$PSScriptRoot\docker-compose.yml",
    "$PSScriptRoot\frontend\app\page.tsx",
    "$PSScriptRoot\frontend\app\login\page.tsx",
    "$PSScriptRoot\frontend\app\barang\page.tsx",
    "$PSScriptRoot\frontend\app\wms\lib\api.ts",
    "$PSScriptRoot\backend\src\main.ts"
)

foreach ($file in $FilesToModify) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $newContent = $content -replace "localhost", $TargetIP
        $newContent = $newContent -replace "127.0.0.1", $TargetIP
        $newContent | Set-Content $file -NoNewline
        echo "  - Diperbarui: $(Split-Path $file -Leaf)"
    }
}

# 3. Build Docker Images
echo "[3/6] Membangun (Build) Docker Containers (tanpa cache)..."
docker-compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    echo "[ERROR] Build gagal! Periksa error di atas."
    exit $LASTEXITCODE
}

# 4. Save Image ke Tar
echo "[4/6] Mengekspor image ke file .tar (WMS_Containers.tar)..."
docker save -o "$DeployDir\WMS_Containers.tar" wms-frontend:latest wms-backend:latest postgres:15-alpine
echo "  - File $DeployDir\WMS_Containers.tar berhasil dibuat."

# 5. Copy Configuration Files ke deploy
echo "[5/6] Menyalin file konfigurasi ke folder deploy..."
Copy-Item "$PSScriptRoot\.env" -Destination "$DeployDir\.env"
Copy-Item "$PSScriptRoot\docker-compose.yml" -Destination "$DeployDir\docker-compose.yml"

# 6. Buat file .sh untuk auto deploy di server
echo "[6/6] Menyiapkan script auto-deploy.sh..."
$shContent = @"
#!/bin/bash

# Script Deployment Otomatis (di Server)
echo "============================================="
echo "   Auto-Deploy WMS PRO ($TargetIP)"
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
echo "   Silakan buka: http://$TargetIP:3001"
echo "============================================="
"@

# Pastikan line endings LF untuk Linux
$shContent = $shContent -replace "`r`n", "`n"
$shContent | Set-Content "$DeployDir\auto-deploy.sh" -NoNewline -Encoding utf8

echo "--------------------------------------------------------"
echo "  Selesai! Semua file sudah siap di folder: $DeployDir"
echo "  Kirimkan folder 'deploy' tersebut ke server tujuan."
echo "--------------------------------------------------------"
