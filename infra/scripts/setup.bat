@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0..\.."

echo ============================================
echo  Home Cleaning - Development Bootstrap
echo  Project: %CD%
echo ============================================
echo.

netstat -ano | findstr ":3000" | findstr "LISTENING" >nul
if errorlevel 1 goto :portok

echo [ERROR] Port 3000 is in use - the API server is still running.
echo.
echo   Prisma cannot update its database engine while the server is running.
echo   Please CLOSE the API window, or press Ctrl+C in it,
echo   then run this script again.
echo.
pause
exit /b 1

:portok

echo [1/5] Checking Docker...

rem Docker Desktop must be running before anything else
docker info >nul 2>&1
if not errorlevel 1 goto :dockerok

echo   Docker Desktop is not running. Trying to start it...
set DOCKER_EXE=%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe
if exist "%DOCKER_EXE%" start "" "%DOCKER_EXE%"

set /a WAIT_COUNT=0
:waitdocker
timeout /t 10 /nobreak >nul
docker info >nul 2>&1
if not errorlevel 1 goto :dockerok
set /a WAIT_COUNT+=1
if %WAIT_COUNT% lss 9 goto :waitdocker

echo.
echo [ERROR] Docker Desktop is not ready.
echo.
echo   Please open Docker Desktop manually, wait until the whale icon
echo   stops animating (about 1 minute), then run this script again.
echo.
pause
exit /b 1

:dockerok
echo   Docker is running

docker ps --format "{{.Names}}" | findstr /C:"hc-mysql" >nul
if errorlevel 1 (
  echo   containers are not running, starting them...
  docker compose -f infra\docker\docker-compose.dev.yml up -d
  timeout /t 8 /nobreak >nul
)
docker ps --format "{{.Names}}" | findstr /C:"hc-mysql" >nul
if errorlevel 1 goto :error
docker ps --format "{{.Names}}" | findstr /C:"hc-redis" >nul
if errorlevel 1 goto :error
echo   OK: hc-mysql and hc-redis are running
echo.

echo [2/5] Installing dependencies...
call pnpm install
if errorlevel 1 goto :error
echo   OK
echo.

echo [3/5] Building shared packages and running unit tests...
call pnpm --filter @hc/shared build
if errorlevel 1 goto :error
call pnpm --filter @hc/pricing build
if errorlevel 1 goto :error
call pnpm --filter @hc/pricing test
if errorlevel 1 goto :error
echo   OK
echo.

echo [4/5] Initializing database (migrate + seed)...
cd apps\api
call .\node_modules\.bin\prisma.cmd generate
if errorlevel 1 goto :error
call .\node_modules\.bin\prisma.cmd migrate dev --name notifications
if errorlevel 1 goto :error
call pnpm run prisma:seed
if errorlevel 1 goto :error
cd /d "%~dp0..\.."
echo   OK
echo.

echo [5/5] Building backend API...
call pnpm run build
if errorlevel 1 goto :error
echo   OK
echo.

echo ============================================
echo  All done!
echo.
echo  Start the server with:  pnpm dev
echo  Then open: http://localhost:3000/api/v1/health
echo ============================================
pause
exit /b 0

:error
echo.
echo ============================================
echo  FAILED - please copy everything above
echo  and send it for troubleshooting.
echo ============================================
pause
exit /b 1
