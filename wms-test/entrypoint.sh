#!/bin/bash
set -e

PGDATA=/var/lib/postgresql/data
POSTGRES_BIN=/usr/bin

mkdir -p /run/postgresql /var/log
chown postgres:postgres /run/postgresql

if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "=== Initializing PostgreSQL ==="
    mkdir -p "$PGDATA"
    chown -R postgres:postgres "$PGDATA"

    su postgres $POSTGRES_BIN/initdb -D $PGDATA

    echo "local all all trust" >> "$PGDATA/pg_hba.conf"
    echo "host all all 127.0.0.1/32 trust" >> "$PGDATA/pg_hba.conf"
    echo "host all all 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"
    echo "listen_addresses = '*'" >> "$PGDATA/postgresql.conf"
    echo "port = 5432" >> "$PGDATA/postgresql.conf"
    echo "unix_socket_directories = /run/postgresql" >> "$PGDATA/postgresql.conf"

    echo "Starting PostgreSQL for initialization..."
    su postgres $POSTGRES_BIN/pg_ctl -D $PGDATA -w -l /var/log/pg_init.log start

    sleep 2

    echo "Creating user ${POSTGRES_USER}..."
    su postgres $POSTGRES_BIN/psql -c "CREATE USER ${POSTGRES_USER} WITH PASSWORD '${POSTGRES_PASSWORD}';"

    echo "Creating database ${POSTGRES_DB}..."
    su postgres $POSTGRES_BIN/psql -c "CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};"
    su postgres $POSTGRES_BIN/psql -c "GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};"

    echo "Stopping PostgreSQL..."
    su postgres $POSTGRES_BIN/pg_ctl -D $PGDATA -w stop
    echo "=== PostgreSQL initialized ==="
fi

# Ensure user exists even if volume was previously initialized but user creation failed
echo "=== Ensuring database user exists ==="
su postgres $POSTGRES_BIN/pg_ctl -D $PGDATA -w -l /var/log/pg_ensure.log start 2>/dev/null || true
sleep 1
USER_EXISTS=$(su postgres $POSTGRES_BIN/psql -t -c "SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER}'" 2>/dev/null | tr -d ' ')
if [ "$USER_EXISTS" != "1" ]; then
    echo "Creating user ${POSTGRES_USER}..."
    su postgres $POSTGRES_BIN/psql -c "CREATE USER ${POSTGRES_USER} WITH PASSWORD '${POSTGRES_PASSWORD}';" 2>/dev/null || true
    su postgres $POSTGRES_BIN/psql -c "CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};" 2>/dev/null || true
    su postgres $POSTGRES_BIN/psql -c "GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};" 2>/dev/null || true
fi
su postgres $POSTGRES_BIN/pg_ctl -D $PGDATA -w stop 2>/dev/null || true
echo "=== Database check complete ==="

echo "Starting all services via supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
