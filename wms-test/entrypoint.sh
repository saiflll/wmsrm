#!/bin/bash
set -e

echo "Starting rm-backend and rm-frontend via supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
