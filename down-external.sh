#!/bin/bash
# Stop & remove containers NOT from this project's docker-compose
# Containers from this project: wms_db fg-backend fg-frontend rm-backend rm-frontend wms_backend

EXTERNAL_CONTAINERS=(
  "forwarder"
  "postgres_db"
  "production-app"
  "ota-app"
  "emqx"
  "backend"
)

for c in "${EXTERNAL_CONTAINERS[@]}"; do
  if docker ps -a --format '{{.Names}}' | grep -q "^$c$"; then
    echo "Stopping & removing $c..."
    docker stop "$c" 2>/dev/null
    docker rm "$c" 2>/dev/null
  else
    echo "$c not found, skipping."
  fi
done

echo "Done."
