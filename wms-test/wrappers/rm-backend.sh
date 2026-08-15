#!/bin/sh
set -e
cd /app/rm-backend
export PORT=3011
export DATABASE_URL=${DATABASE_URL:-postgresql://wms_user:wms_password@wms-test-db:5432/wms_db}
export JWT_SECRET=rm_super_secret_key_change_me
export NODE_OPTIONS="--max-old-space-size=512"

# Extract hostname and port from DATABASE_URL
DB_HOST=$(echo $DATABASE_URL | sed -e 's|.*@||' -e 's|:.*||' -e 's|/.*||')
DB_PORT=$(echo $DATABASE_URL | grep -o ':[0-9]\+' | sed 's/://' || echo "5432")

echo "Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."
for i in $(seq 1 30); do
    pg_isready -h $DB_HOST -p $DB_PORT >/dev/null 2>&1 && break
    echo "  Attempt $i: PG not ready yet..."
    sleep 2
done

echo "PostgreSQL is ready, starting backend..."
exec node dist/main
