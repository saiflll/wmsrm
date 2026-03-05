@echo off
set /p DOCKER_USER=Masukkan Docker Hub Username Anda: 

echo Login ke Docker Hub...
docker login -u %DOCKER_USER%

if %errorlevel% neq 0 (
    echo.
    echo Login gagal. Script dihentikan.
    pause
    exit /b %errorlevel%
)

echo.
echo Build Frontend Image...
docker build -t %DOCKER_USER%/wms_frontend:latest ./frontend

echo.
echo Build Backend Image...
docker build -t %DOCKER_USER%/wms_backend:latest ./backend

echo.
echo Push Frontend Image...
docker push %DOCKER_USER%/wms_frontend:latest

echo.
echo Push Backend Image...
docker push %DOCKER_USER%/wms_backend:latest

echo.
echo ==========================================
echo Selesai! Image sudah berhasil diupload ke Docker Hub.
echo Anda sekarang bisa memanggil image ini dari server lain.
echo ==========================================
pause
