#!/bin/sh
set -e
cd /app/rm-backend
export PORT=3011
export DATABASE_URL=postgresql://wms_user:wms_password@localhost:5432/wms_db
export JWT_SECRET=rm_super_secret_key_change_me

echo "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
    pg_isready -h localhost -p 5432 >/dev/null 2>&1 && break
    echo "  Attempt $i: PG not ready yet..."
    sleep 2
done

echo "PostgreSQL is ready, starting backend..."
exec node dist/main
