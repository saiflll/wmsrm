@echo off
setlocal

echo ========================================================
echo   Deploy WMS App (LOCAL TESTING)
echo ========================================================

:: Check if .env.local exists, if not create from .env
if not exist .env.local (
    echo [INFO] .env.local not found, creating from .env...
    copy .env .env.local
)

echo.
echo [1/3] Stopping existing local containers...
docker compose -f docker-compose.local.yml down

echo.
echo [2/3] Building and Starting WMS Services...
echo This might take a few minutes for the first time...
docker compose -f docker-compose.local.yml up -d --build

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker Compose failed!
    pause
    exit /b 1
)

echo.
echo ========================================================
echo   SUCCESS! WMS is running locally.
echo ========================================================
echo   Frontend: http://localhost:3001
echo   Backend:  http://localhost:3002
echo   Database: localhost:4321
echo ========================================================
echo.
echo Current Status:
docker compose -f docker-compose.local.yml ps

pause
