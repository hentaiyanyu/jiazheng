# ============================================================
# Home Cleaning Service - development bootstrap
# Idempotent: safe to run multiple times.
#
# Usage (run from anywhere):
#   powershell -NoProfile -ExecutionPolicy Bypass -File "<full-path>\setup.ps1"
# Or just double-click setup.bat in the same folder.
# ============================================================

$ErrorActionPreference = 'Stop'

# Resolve project root: this file lives in <root>\infra\scripts\
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

function Step($text) {
  Write-Host ""
  Write-Host "=== $text ===" -ForegroundColor Cyan
}

function Ok($text) {
  Write-Host "  [OK] $text" -ForegroundColor Green
}

function Fail($text) {
  Write-Host "  [FAIL] $text" -ForegroundColor Red
}

# ------------------------------------------------------------
# Resolve pnpm: PATH -> common install dirs -> corepack -> npm install -g
# ------------------------------------------------------------
function Resolve-Pnpm {
  $script:PnpmPrefix = @()

  $cmd = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($cmd) {
    # 优先使用原生的 pnpm.cmd（.ps1 包装脚本在部分环境下行为不稳定）
    $dir = Split-Path -Parent $cmd.Source
    $cmdShim = Join-Path $dir 'pnpm.cmd'
    if (Test-Path $cmdShim) {
      $script:PnpmExe = $cmdShim
    } else {
      $script:PnpmExe = $cmd.Source
    }
    return
  }

  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'pnpm\pnpm.exe'),
    (Join-Path $env:APPDATA 'npm\pnpm.cmd'),
    (Join-Path ${env:ProgramFiles} 'nodejs\pnpm.cmd')
  )

  foreach ($path in $candidates) {
    if ($path -and (Test-Path $path)) {
      $script:PnpmExe = $path
      return
    }
  }

  $corepack = Join-Path ${env:ProgramFiles} 'nodejs\corepack.cmd'
  if (Test-Path $corepack) {
    Write-Host "  pnpm not found, trying corepack..." -ForegroundColor Yellow
    $env:COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
    & $corepack pnpm --version *> $null
    if ($LASTEXITCODE -eq 0) {
      $script:PnpmExe = $corepack
      $script:PnpmPrefix = @('pnpm')
      return
    }
  }

  if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "  pnpm not found, installing it with npm (one time)..." -ForegroundColor Yellow
    & npm install -g pnpm

    $installed = Join-Path $env:APPDATA 'npm\pnpm.cmd'
    if (Test-Path $installed) {
      $script:PnpmExe = $installed
      return
    }

    $cmd2 = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($cmd2) {
      $script:PnpmExe = $cmd2.Source
      return
    }
  }
}

function Invoke-Pnpm {
  param([string[]]$PnpmArgs)

  # NOTE: 必须先把参数拼成数组再 splat（@allArgs），
  # 否则 PowerShell 会把整个数组拼成一个带空格的字符串传给命令。
  $allArgs = @($script:PnpmPrefix) + @($PnpmArgs)
  $display = $allArgs -join ' '
  $prevPreference = $ErrorActionPreference

  # pnpm 会把警告写到 stderr；这里临时放宽，避免被当成致命错误中断脚本
  $ErrorActionPreference = 'Continue'
  try {
    & $script:PnpmExe @allArgs
    $code = $LASTEXITCODE
  } catch {
    $ErrorActionPreference = $prevPreference
    Fail "failed to run: $script:PnpmExe $display"
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    exit 1
  }
  $ErrorActionPreference = $prevPreference

  # $LASTEXITCODE 可能为 $null（调用 .ps1 包装脚本时不会设置），此时不能判定为失败
  if ($null -ne $code -and $code -ne 0) {
    Fail "command failed (exit code $code): pnpm $display"
    exit 1
  }
}

if (-not (Test-Path (Join-Path $root 'package.json'))) {
  Fail "package.json not found under $root"
  exit 1
}

Write-Host "Project root: $root"

# ------------------------------------------------------------
Step "1/5 Check Docker and database containers"
# ------------------------------------------------------------

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Fail "docker command not found. Please install and start Docker Desktop."
  exit 1
}

$names = @(docker ps --format "{{.Names}}")

if ($names -notcontains 'hc-mysql' -or $names -notcontains 'hc-redis') {
  Write-Host "  containers are not running, starting..." -ForegroundColor Yellow
  docker compose -f infra/docker/docker-compose.dev.yml up -d
  Start-Sleep -Seconds 8
  $names = @(docker ps --format "{{.Names}}")
}

if ($names -contains 'hc-mysql' -and $names -contains 'hc-redis') {
  Ok "hc-mysql and hc-redis are running"
} else {
  Fail "containers failed to start. Is Docker Desktop running?"
  exit 1
}

# ------------------------------------------------------------
Step "2/5 Install dependencies"
# ------------------------------------------------------------

Resolve-Pnpm
if (-not $script:PnpmExe) {
  Fail "pnpm not found and automatic install failed."
  Write-Host "  Please run: npm install -g pnpm" -ForegroundColor Yellow
  Write-Host "  Then run this script again." -ForegroundColor Yellow
  exit 1
}
Write-Host "  using pnpm: $script:PnpmExe"

Invoke-Pnpm @('install')
Ok "dependencies installed"

# ------------------------------------------------------------
Step "3/5 Build shared packages and run unit tests"
# ------------------------------------------------------------

Invoke-Pnpm @('--filter', '@hc/shared', 'build')
Invoke-Pnpm @('--filter', '@hc/pricing', 'build')
Invoke-Pnpm @('--filter', '@hc/pricing', 'test')
Ok "shared packages built, pricing tests passed"

# ------------------------------------------------------------
Step "4/5 Init database (migrate + seed)"
# ------------------------------------------------------------

Set-Location (Join-Path $root 'apps\api')

& .\node_modules\.bin\prisma.CMD generate
Ok "prisma client generated"

& .\node_modules\.bin\prisma.CMD migrate dev --name catalog_timeslot_coupon
Ok "database schema is in sync"

Invoke-Pnpm @('run', 'prisma:seed')
Ok "seed data inserted"

# ------------------------------------------------------------
Step "5/5 Build API"
# ------------------------------------------------------------

Invoke-Pnpm @('run', 'build')
Ok "api build passed"

Set-Location $root

Write-Host ""
Write-Host "All done." -ForegroundColor Green
Write-Host ""
Write-Host "Start the API server with:" -ForegroundColor Cyan
Write-Host "  pnpm dev"
Write-Host ""
Write-Host "Then open in browser:" -ForegroundColor Cyan
Write-Host "  http://localhost:3000/api/v1/health"
Write-Host "  http://localhost:3000/api/v1/categories"
Write-Host ""
