#!/bin/sh
set -eu

# VPS hanya menarik image hasil GitHub Actions; tidak pernah build secara lokal.
cd "$(dirname "$0")/.."
docker compose pull wms-test
docker compose up -d --no-build wms-test-db wms-test
docker image prune -f
docker compose ps
