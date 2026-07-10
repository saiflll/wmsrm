#!/bin/sh
export PORT=3013
export DATABASE_URL=postgresql://wms_user:wms_password@localhost:5432/wms_db
export JWT_SECRET=fg_super_secret_key_change_me
exec node dist/main
