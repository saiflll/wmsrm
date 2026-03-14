@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   Auto-Deploy WMS to Server (172.20.100.11)
echo ========================================================

:: 1. Pull latest from GitHub
echo [1/5] Pulling latest code from GitHub...
:: Pastikan folder ini adalah repo git
if not exist .git (
    echo [INFO] .git folder not found. Attempting to initialize or you might need to clone.
    :: Jika ingin clone otomatis bisa ditambahkan di sini, tapi kita asumsikan sudah ada.
)
git pull origin main
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Git pull failed. Mencoba melanjutkan...
)

:: 2. Replace Local Settings to Server IP
echo [2/5] Updating IP addresses to 172.20.100.11...
powershell -Command "(gc docker-compose.yml) -replace 'localhost', '172.20.100.11' | Out-File -encoding utf8 docker-compose.yml"
powershell -Command "(gc .env) -replace 'localhost', '172.20.100.11' | Out-File -encoding utf8 .env"

:: 3. Build and Run without cache
echo [3/5] Building and Running Docker containers (No Cache)...
:: Down dulu untuk memastikan state bersih
docker compose down
docker compose build --no-cache
docker compose up -d
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker deployment failed.
    exit /b %ERRORLEVEL%
)

:: 4. Clean up Docker images (Optional prune)
echo [4/5] Pruning unused Docker images to save space...
docker image prune -f

:: 5. Delete source files except essential ones
echo [5/5] Cleaning up source directory...
echo Mempertahankan: .env, docker-compose.yml, deploy_server.bat, dan folder .git
for /F "delims=" %%i in ('dir /b /a') do (
    set "keep=0"
    if /I "%%i"==".env" set "keep=1"
    if /I "%%i"=="docker-compose.yml" set "keep=1"
    if /I "%%i"=="deploy_server.bat" set "keep=1"
    if /I "%%i"==".git" set "keep=1"
    
    if "!keep!"=="0" (
        if exist "%%i\" (
            echo Deleting folder: %%i
            rd /s /q "%%i"
        ) else (
            echo Deleting file: %%i
            del /f /q "%%i"
        )
    )
)

echo ========================================================
echo   DEPLOYMENT SELESAI! 
echo   Data DB aman di volume 'postgres_data'.
echo ========================================================
pause
