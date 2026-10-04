@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0..\.."

echo ============================================
echo  Push project to GitHub
echo ============================================
echo.

set REPO_URL=%1
if "%REPO_URL%"=="" set /p REPO_URL=Repository URL (https://github.com/...git):

if "%REPO_URL%"=="" (
  echo [ERROR] Repository URL is required.
  pause
  exit /b 1
)

rem Git identity is required for the first commit
git config user.name >nul 2>&1
if errorlevel 1 (
  echo.
  echo [ERROR] Git identity is not configured yet.
  echo.
  echo   Run these two commands first:
  echo     git config --global user.name "Your Name"
  echo     git config --global user.email "you@example.com"
  echo.
  pause
  exit /b 1
)

echo.
echo [1/5] Staging files...
git add .
if errorlevel 1 goto :error

echo [2/5] Creating commit...
git commit -m "feat: initial commit of home cleaning miniprogram"
if errorlevel 1 (
  echo   Nothing new to commit, continue.
)

echo [3/5] Setting remote...
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%
if errorlevel 1 goto :error

echo [4/5] Renaming branch to main...
git branch -M main
if errorlevel 1 goto :error

echo [5/5] Pushing to GitHub...
git push -u origin main
if errorlevel 1 (
  echo.
  echo   Push rejected. This usually means the remote repository was created
  echo   with an auto-generated README, so the two histories are unrelated.
  echo   Retrying with --force (only the auto-generated README will be replaced) ...
  echo.
  git push -u origin main --force
  if errorlevel 1 goto :error
)

echo.
echo ============================================
echo  Done. Open your repository in the browser.
echo ============================================
pause
exit /b 0

:error
echo.
echo ============================================
echo  FAILED - copy the messages above
echo ============================================
pause
exit /b 1
