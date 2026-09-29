@echo off
chcp 65001 >nul
echo ============================================
echo   Catan Seafarers 3D - Setup and Start
echo ============================================
echo.

:: Kiem tra Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
  echo [LOI] Node.js chua duoc cai dat!
  echo.
  echo Hay cai Node.js tai: https://nodejs.org
  echo Chon phien ban LTS
  echo.
  start https://nodejs.org
  pause
  exit /b 1
)

echo [OK] Node.js da san sang:
node --version
npm --version
echo.

:: Di vao thu muc server
cd /d "%~dp0server"

:: Kiem tra node_modules
if not exist "node_modules" (
  echo [1/2] Cai dat dependencies (lan dau, co the mat 1-2 phut)...
  call npm install
  if %errorlevel% neq 0 (
    echo [LOI] npm install that bai!
    pause
    exit /b 1
  )
  echo [OK] Dependencies da cai xong!
  echo.
) else (
  echo [OK] Dependencies da co san.
)

:: Khoi dong server
echo [2/2] Khoi dong server...
echo.
echo ============================================
echo   Server dang chay: http://localhost:3000
echo   Mo trinh duyet va truy cap dia chi tren!
echo   Nhan Ctrl+C de dung server
echo ============================================
echo.
node server.js
pause
