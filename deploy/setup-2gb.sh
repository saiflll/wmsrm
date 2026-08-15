#!/bin/bash
# =============================================
# WMS PRO - VPS Setup for 2GB RAM
# Target OS: Debian 13 (Trixie)
# Jalankan sebagai root: sudo bash setup-2gb.sh
# =============================================
set -e

echo "==> [1/6] Update sistem & install paket dasar (Debian 13)..."

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    rsync \
    git \
    ufw \
    fail2ban

echo "==> [2/6] Membuat SWAP 2GB (anti OOM killer saat build & spike)..."

if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "Swap 2GB dibuat & aktif."
else
    echo "Swapfile sudah ada, lewati."
fi

echo "==> [3/6] Tuning kernel (kurangi swap-thrash, prioritaskan RAM)..."

cat > /etc/sysctl.d/99-wms.conf <<'EOF'
vm.swappiness = 10
vm.vfs_cache_pressure = 50
vm.overcommit_memory = 0
net.core.somaxconn = 1024
EOF
sysctl -p /etc/sysctl.d/99-wms.conf

echo "==> [4/6] Install Docker Engine (repo resmi Docker, cocok Debian 13)..."
echo "     (Debian 13 Trixie masih baru - pakai repo Docker resmi, bukan paket Debian)"

if ! command -v docker >/dev/null 2>&1; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Debian 13 pakai format deb822 (.sources) - rekomendasi resmi
    cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: trixie
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.gpg
EOF

    apt-get update
    apt-get install -y --no-install-recommends \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin

    systemctl enable --now docker
    echo "Docker Engine + compose plugin terinstall (repo resmi, deb822)."
else
    echo "Docker sudah ada."
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "ERROR: docker compose plugin belum ada." >&2
    exit 1
fi

echo "==> [5/6] Konfigurasi firewall (UFW)..."

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 3014/tcp comment 'WMS Backend API'
ufw allow 3015/tcp comment 'WMS Frontend'
ufw --force enable
systemctl enable ufw
echo "UFW aktif: SSH(22), Backend(3014), Frontend(3015)."
echo "     Jika mau akses DB dari luar, tambah: ufw allow 3013/tcp"

echo "==> [6/6] Selesai."
echo ""
echo "Langkah selanjutnya (alur GHCR - VPS hanya pull, tidak build):"
echo "  1. Push code ke GitHub (branch master) - workflow otomatis build & push ke GHCR"
echo "  2. Di VPS, login GHCR dulu sekali:"
echo "       echo \$GHCR_TOKEN | docker login ghcr.io -u <username> --password-stdin"
echo "  3. Jalankan app (pull image dari GHCR):"
echo "       GHCR_OWNER=<owner> docker compose pull wms-test"
echo "       GHCR_OWNER=<owner> docker compose up -d"
echo "  4. Cek log:  docker logs wms-test --tail 50"