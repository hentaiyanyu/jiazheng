@echo off
setlocal
chcp 65001 >nul

echo ============================================
echo  Install and configure GitHub CLI (gh)
echo ============================================
echo.

where gh >nul 2>&1
if not errorlevel 1 goto :ready

echo [1/2] Installing GitHub CLI via winget...
echo.
winget install --id GitHub.cli --exact --accept-source-agreements --accept-package-agreements
if errorlevel 1 goto :wingetfail

rem Make gh available in the current session
set "PATH=%PATH%;%ProgramFiles%\GitHub CLI"

:ready
where gh >nul 2>&1
if errorlevel 1 (
  echo.
  echo [INFO] GitHub CLI was installed.
  echo        Please CLOSE this window, open a NEW PowerShell window,
  echo        then run this script again to finish login.
  echo.
  pause
  exit /b 0
)

echo [2/2] Checking GitHub login status...
echo.
gh auth status
if not errorlevel 1 goto :done

echo.
echo Not logged in yet. Starting login, please follow the prompts:
echo   1^) What account do you want to log into?      -^> GitHub.com
echo   2^) Preferred protocol for Git operations?    -^> HTTPS
echo   3^) Authenticate Git with your GitHub credentials? -^> Yes
echo   4^) How would you like to authenticate?       -^> Login with a web browser
echo.
echo   Then copy the one-time code shown and paste it in the browser.
echo.
gh auth login
if errorlevel 1 goto :error

:done
echo.
echo ============================================
echo  Done. GitHub CLI is ready.
echo.
echo  From now on, you can ask Codex to:
echo    gh repo create PROJECT --private --source=. --push
echo ============================================
pause
exit /b 0

:wingetfail
echo.
echo ============================================
echo  winget install failed.
echo.
echo  Often caused by network issues reaching GitHub.
echo  Please install manually:
echo    1. Open https://github.com/cli/cli/releases in your browser
echo    2. Download the Windows .msi (gh_x.x.x_windows_amd64.msi)
echo    3. Install it, then run this script again
echo ============================================
pause
exit /b 1

:error
echo.
echo ============================================
echo  FAILED - copy the messages above
echo ============================================
pause
exit /b 1
