#!/bin/bash
set -e

PGDATA=/var/lib/postgresql/data
POSTGRES_BIN=/usr/bin

mkdir -p /run/postgresql /var/log
chown postgres:postgres /run/postgresql

# Initialize if fresh
if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "=== Initializing PostgreSQL ==="
    mkdir -p "$PGDATA"
    chown -R postgres:postgres "$PGDATA"

    su postgres -c "$POSTGRES_BIN/initdb -D $PGDATA"

    # Overwrite config dengan yang sudah di-hardcode
    cp /etc/postgresql/postgresql.conf "$PGDATA/postgresql.conf"
    cp /etc/postgresql/pg_hba.conf "$PGDATA/pg_hba.conf"
    chown postgres:postgres "$PGDATA/postgresql.conf" "$PGDATA/pg_hba.conf"

    echo "Starting PostgreSQL for initialization..."
    su postgres -c "$POSTGRES_BIN/pg_ctl -D $PGDATA -w -l /var/log/pg_init.log start"
    sleep 2

    echo "Creating user ${POSTGRES_USER}..."
    su postgres -c "$POSTGRES_BIN/psql -c \"CREATE USER ${POSTGRES_USER} WITH PASSWORD '${POSTGRES_PASSWORD}';\""
    su postgres -c "$POSTGRES_BIN/psql -c \"CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};\""
    su postgres -c "$POSTGRES_BIN/psql -c \"GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};\""

    su postgres -c "$POSTGRES_BIN/pg_ctl -D $PGDATA -w stop"
    echo "=== PostgreSQL initialized ==="
else
    # Volume sudah ada, tapi pastikan config benar
    echo "=== Patching PostgreSQL config ==="
    cp /etc/postgresql/postgresql.conf "$PGDATA/postgresql.conf"
    cp /etc/postgresql/pg_hba.conf "$PGDATA/pg_hba.conf"
    chown postgres:postgres "$PGDATA/postgresql.conf" "$PGDATA/pg_hba.conf"
fi

# Ensure user exists
echo "=== Ensuring database user exists ==="
su postgres -c "$POSTGRES_BIN/pg_ctl -D $PGDATA -w -l /var/log/pg_ensure.log start" 2>/dev/null || true
sleep 2
USER_EXISTS=$(su postgres -c "$POSTGRES_BIN/psql -t -c \"SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER}'\"" 2>/dev/null | tr -d ' ')
if [ "$USER_EXISTS" != "1" ]; then
    echo "Creating user ${POSTGRES_USER}..."
    su postgres -c "$POSTGRES_BIN/psql -c \"CREATE USER ${POSTGRES_USER} WITH PASSWORD '${POSTGRES_PASSWORD}';\"" 2>/dev/null || true
    su postgres -c "$POSTGRES_BIN/psql -c \"CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};\"" 2>/dev/null || true
    su postgres -c "$POSTGRES_BIN/psql -c \"GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};\"" 2>/dev/null || true
fi
su postgres -c "$POSTGRES_BIN/pg_ctl -D $PGDATA -w stop" 2>/dev/null || true
echo "=== Database check complete ==="

echo "Starting all services via supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
