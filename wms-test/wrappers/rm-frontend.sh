#!/bin/sh
cd /app/rm-frontend
export PORT=3000
export BACKEND_API_URL=http://localhost:3011
exec npm start
