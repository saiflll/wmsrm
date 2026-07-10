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

    su - postgres -c "$POSTGRES_BIN/initdb -D $PGDATA"

    echo "local all all trust" >> "$PGDATA/pg_hba.conf"
    echo "host all all 127.0.0.1/32 trust" >> "$PGDATA/pg_hba.conf"
    echo "host all all 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"
    echo "listen_addresses = '*'" >> "$PGDATA/postgresql.conf"
    echo "port = 5432" >> "$PGDATA/postgresql.conf"
    echo "unix_socket_directories = /run/postgresql" >> "$PGDATA/postgresql.conf"

    echo "Starting PostgreSQL for initialization..."
    su - postgres -c "$POSTGRES_BIN/pg_ctl -D $PGDATA -w -l /var/log/pg_init.log start"

    sleep 2

    echo "Creating user ${POSTGRES_USER}..."
    su - postgres -c "$POSTGRES_BIN/psql -c \"CREATE USER ${POSTGRES_USER} WITH PASSWORD '${POSTGRES_PASSWORD}';\""

    echo "Creating database ${POSTGRES_DB}..."
    su - postgres -c "$POSTGRES_BIN/psql -c \"CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};\""
    su - postgres -c "$POSTGRES_BIN/psql -c \"GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};\""

    echo "Stopping PostgreSQL..."
    su - postgres -c "$POSTGRES_BIN/pg_ctl -D $PGDATA -w stop"
    echo "=== PostgreSQL initialized ==="
fi

echo "Starting all services via supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
