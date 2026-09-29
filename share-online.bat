@echo off
chcp 65001 >nul
echo ========================================================
echo   Catan Seafarers 3D — Chơi Cùng Bạn Bè Qua Mạng
echo ========================================================
echo.
echo [1/2] Đang khởi động Game Server...
start "Catan Game Server" cmd /c "cd /d \"%~dp0server\" && node server.js"

timeout /t 2 >nul

echo [2/2] Đang tạo link HTTPS công khai để chia sẻ cho bạn bè...
echo.
echo ========================================================
echo  HƯỚNG DẪN:
echo  1. Copy link "your url is: https://..." hiển thị bên dưới
echo  2. Gửi link đó cho bạn bè để cùng vào chơi
echo  3. Để tắt kết nối: bấm Ctrl+C hoặc đóng cửa sổ này
echo ========================================================
echo.

npx --yes localtunnel --port 3000
pause
