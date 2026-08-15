#!/bin/sh
cd /app/rm-frontend
export PORT=3000
export BACKEND_API_URL=http://localhost:3011
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=512"
exec npm start
