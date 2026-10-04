@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0..\.."

echo ============================================
echo  Home Cleaning - Admin Console
echo ============================================
echo.
echo  Admin console: http://localhost:5173
echo  Default account: admin / admin123
echo.
echo  Make sure the API server (start-dev.bat) is running too.
echo  Press Ctrl+C to stop.
echo ============================================
echo.

call pnpm --filter @hc/admin dev

pause
