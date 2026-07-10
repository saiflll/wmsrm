#!/bin/sh
cd /app/fg-frontend
export NEXT_PUBLIC_API_URL=http://localhost:3013
exec npm start
