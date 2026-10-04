@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0..\.."

echo ============================================
echo  Home Cleaning - Start API Server
echo ============================================
echo.
echo  The server runs at http://localhost:3000/api/v1
echo.
echo  Open these URLs in your browser to verify:
echo    http://localhost:3000/api/v1/health
echo    http://localhost:3000/api/v1/categories
echo    http://localhost:3000/api/v1/services
echo    http://localhost:3000/api/v1/services/1
echo    http://localhost:3000/api/v1/areas/check?districtCode=310115
echo.
echo  Press Ctrl+C to stop the server.
echo ============================================
echo.

call pnpm dev

pause
