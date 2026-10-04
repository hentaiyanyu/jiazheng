# ============================================================
# 开发环境一键初始化脚本（可重复执行，不会重复写入数据）
#
# 用法：在 PowerShell 中执行
#   powershell -ExecutionPolicy Bypass -File infra\scripts\init-dev.ps1
# 或者右键本文件 -> 使用 PowerShell 运行
# ============================================================

$ErrorActionPreference = 'Stop'

# 项目根目录（本文件位于 <root>\infra\scripts\）
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

if (-not (Test-Path (Join-Path $root 'package.json'))) {
  Write-Host "定位项目根目录失败：$root 下没有找到 package.json" -ForegroundColor Red
  Write-Host "请把本文件放在 <项目根>\infra\scripts\ 目录下再运行。" -ForegroundColor Red
  exit 1
}

function Write-Step($text) {
  Write-Host ""
  Write-Host "=== $text ===" -ForegroundColor Cyan
}

function Write-Ok($text) {
  Write-Host "  [OK] $text" -ForegroundColor Green
}

function Write-Fail($text) {
  Write-Host "  [失败] $text" -ForegroundColor Red
}

Write-Host "项目目录：$root"

# ------------------------------------------------------------
# 1. 检查 Docker 与数据库容器
# ------------------------------------------------------------
Write-Step "1/5 检查 Docker 与数据库"

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  Write-Fail "未找到 docker 命令。请先安装并启动 Docker Desktop。"
  exit 1
}

$running = docker ps --format "{{.Names}}" 2>$null
if ($running -notcontains 'hc-mysql' -or $running -notcontains 'hc-redis') {
  Write-Host "  容器未运行，正在启动..." -ForegroundColor Yellow
  docker compose -f infra/docker/docker-compose.dev.yml up -d
  Start-Sleep -Seconds 8
  $running = docker ps --format "{{.Names}}" 2>$null
}

if ($running -contains 'hc-mysql' -and $running -contains 'hc-redis') {
  Write-Ok "hc-mysql 与 hc-redis 均在运行"
} else {
  Write-Fail "容器启动失败，请检查 Docker Desktop 是否已启动"
  exit 1
}

# ------------------------------------------------------------
# 2. 安装依赖
# ------------------------------------------------------------
Write-Step "2/5 安装依赖"
pnpm install
Write-Ok "依赖安装完成"

# ------------------------------------------------------------
# 3. 构建共享包与价格引擎
# ------------------------------------------------------------
Write-Step "3/5 构建共享包与价格引擎"
pnpm --filter @hc/shared build
pnpm --filter @hc/pricing build
Write-Ok "共享包构建完成"

Write-Host "  运行价格引擎单元测试..." -ForegroundColor DarkGray
pnpm --filter @hc/pricing test
Write-Ok "单元测试通过"

# ------------------------------------------------------------
# 4. 数据库迁移与种子数据
# ------------------------------------------------------------
Write-Step "4/5 初始化数据库"
Push-Location (Join-Path $root 'apps\api')
try {
  # 生成 Prisma 客户端
  & .\node_modules\.bin\prisma.CMD generate
  Write-Ok "Prisma 客户端已生成"

  # 执行迁移（无变更时 Prisma 会自动跳过）
  & .\node_modules\.bin\prisma.CMD migrate dev --name catalog_timeslot_coupon
  Write-Ok "数据库表结构已同步"

  # 写入种子数据
  pnpm run prisma:seed
  Write-Ok "种子数据写入完成"
} finally {
  Pop-Location
}

# ------------------------------------------------------------
# 5. 编译后端
# ------------------------------------------------------------
Write-Step "5/5 编译后端"
pnpm --filter @hc/api build
Write-Ok "后端编译通过"

# ------------------------------------------------------------
Write-Host ""
Write-Host "全部完成" -ForegroundColor Green
Write-Host ""
Write-Host "启动服务：" -ForegroundColor Cyan
Write-Host "  pnpm dev"
Write-Host ""
Write-Host "验证接口：" -ForegroundColor Cyan
Write-Host "  http://localhost:3000/api/v1/health"
Write-Host "  http://localhost:3000/api/v1/categories"
Write-Host ""
