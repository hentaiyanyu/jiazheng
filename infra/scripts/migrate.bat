@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0..\..\apps\api"

set MIGNAME=%1
if "%MIGNAME%"=="" set MIGNAME=auto_migration

echo Applying database migration: %MIGNAME%
echo.

call .\node_modules\.bin\prisma.cmd generate
if errorlevel 1 goto :error

call .\node_modules\.bin\prisma.cmd migrate dev --name %MIGNAME%
if errorlevel 1 goto :error

echo.
echo Migration done.
pause
exit /b 0

:error
echo.
echo ============================================
echo  MIGRATION FAILED - copy the messages above
echo ============================================
pause
exit /b 1
