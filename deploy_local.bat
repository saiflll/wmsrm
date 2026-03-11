@echo off
echo ========================================================
echo   Deploy WMS App (Local) - Rebuild + Restart
echo ========================================================

echo.
echo [1/3] Build Frontend (no-cache)...
docker build --no-cache -t wms-frontend:latest ./frontend
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build frontend gagal!
    pause
    exit /b 1
)

echo.
echo [2/3] Build Backend (no-cache)...
docker build --no-cache -t wms-backend:latest ./backend
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build backend gagal!
    pause
    exit /b 1
)

echo.
echo [3/3] Restart containers...
docker rm -f wms_frontend wms_backend 2>nul
docker compose up -d --no-build
if %ERRORLEVEL% neq 0 (
    echo Mencoba start manual...
    for /f "tokens=*" %%i in ('docker network ls --filter name^=wms --format "{{.Name}}"') do set NETNAME=%%i
    docker run -d --name wms_backend --network %NETNAME% -p 3001:3001 wms-backend:latest
    docker run -d --name wms_frontend --network %NETNAME% -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://wms_backend:3001 wms-frontend:latest
)

echo.
echo ========================================================
echo   Selesai! Akses: http://localhost:3000
echo ========================================================
pause
